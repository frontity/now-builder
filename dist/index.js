"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const cross_spawn_1 = __importDefault(require("cross-spawn"));
const get_port_1 = __importDefault(require("get-port"));
const promise_timeout_1 = require("promise-timeout");
const fs_1 = require("fs");
const frameworks_1 = __importDefault(require("./frameworks"));
const build_utils_1 = require("@now/build-utils");
function validateDistDir(distDir, isDev, config) {
    const distDirName = path_1.default.basename(distDir);
    const exists = () => fs_1.existsSync(distDir);
    const isDirectory = () => fs_1.statSync(distDir).isDirectory();
    const isEmpty = () => fs_1.readdirSync(distDir).length === 0;
    const hash = isDev
        ? '#local-development'
        : '#configuring-the-build-output-directory';
    const docsUrl = `https://zeit.co/docs/v2/deployments/official-builders/static-build-now-static-build${hash}`;
    const info = config.zeroConfig
        ? '\nMore details: https://zeit.co/docs/v2/advanced/platform/frequently-asked-questions#missing-public-directory'
        : `\nMake sure you configure the the correct distDir: ${docsUrl}`;
    if (!exists()) {
        throw new Error(`No output directory named "${distDirName}" found.${info}`);
    }
    if (!isDirectory()) {
        throw new Error(`Build failed because distDir is not a directory: "${distDirName}".${info}`);
    }
    if (isEmpty()) {
        throw new Error(`Build failed because distDir is empty: "${distDirName}".${info}`);
    }
}
function getCommand(pkg, cmd, { zeroConfig }) {
    // The `dev` script can be `now dev`
    const nowCmd = `now-${cmd}`;
    if (!zeroConfig && cmd === 'dev') {
        return nowCmd;
    }
    const scripts = (pkg && pkg.scripts) || {};
    if (scripts[nowCmd]) {
        return nowCmd;
    }
    if (scripts[cmd]) {
        return cmd;
    }
    return zeroConfig ? cmd : nowCmd;
}
exports.version = 2;
const nowDevScriptPorts = new Map();
const getDevRoute = (srcBase, devPort, route) => {
    const basic = {
        src: `${srcBase}${route.src}`,
        dest: `http://localhost:${devPort}${route.dest}`,
    };
    if (route.headers) {
        basic.headers = route.headers;
    }
    return basic;
};
async function build({ files, entrypoint, workPath, config, meta = {}, }) {
    console.log('Downloading user files...');
    await build_utils_1.download(files, workPath, meta);
    const mountpoint = path_1.default.dirname(entrypoint);
    const entrypointDir = path_1.default.join(workPath, mountpoint);
    let distPath = path_1.default.join(workPath, path_1.default.dirname(entrypoint), (config && config.distDir) || 'build/static');
    const entrypointName = path_1.default.basename(entrypoint);
    if (entrypointName === 'package.json') {
        const pkgPath = path_1.default.join(workPath, entrypoint);
        const pkg = JSON.parse(fs_1.readFileSync(pkgPath, 'utf8'));
        let output = {};
        let framework = undefined;
        let minNodeRange = undefined;
        const routes = [];
        const devScript = getCommand(pkg, 'dev', config);
        if (config.zeroConfig) {
            // `public` is the default for zero config
            distPath = path_1.default.join(workPath, path_1.default.dirname(entrypoint), 'public');
            const dependencies = Object.assign({}, pkg.dependencies, pkg.devDependencies);
            framework = frameworks_1.default.find(({ dependency }) => dependencies[dependency]);
        }
        if (framework) {
            console.log(`Detected ${framework.name} framework. Optimizing your deployment...`);
            if (framework.minNodeRange) {
                minNodeRange = framework.minNodeRange;
                console.log(`${framework.name} requires Node.js ${framework.minNodeRange}. Switching...`);
            }
            else {
                console.log(`${framework.name} does not require a specific Node.js version. Continuing ...`);
            }
        }
        const nodeVersion = await build_utils_1.getNodeVersion(entrypointDir, minNodeRange);
        const spawnOpts = build_utils_1.getSpawnOptions(meta, nodeVersion);
        await build_utils_1.runNpmInstall(entrypointDir, ['--prefer-offline'], spawnOpts);
        if (meta.isDev && pkg.scripts && pkg.scripts[devScript]) {
            let devPort = nowDevScriptPorts.get(entrypoint);
            if (framework && framework.defaultRoutes) {
                // We need to delete the routes for `now dev`
                // since in this case it will get proxied to
                // a custom server we don't have controll over
                delete framework.defaultRoutes;
            }
            if (typeof devPort === 'number') {
                console.log('`%s` server already running for %j', devScript, entrypoint);
            }
            else {
                // Run the `now-dev` or `dev` script out-of-bounds, since it is assumed that
                // it will launch a dev server that never "completes"
                devPort = await get_port_1.default();
                nowDevScriptPorts.set(entrypoint, devPort);
                const opts = {
                    cwd: entrypointDir,
                    env: { ...process.env, PORT: String(devPort) },
                };
                const child = cross_spawn_1.default('yarn', ['run', devScript], opts);
                child.on('exit', () => nowDevScriptPorts.delete(entrypoint));
                if (child.stdout) {
                    child.stdout.setEncoding('utf8');
                    child.stdout.pipe(process.stdout);
                }
                if (child.stderr) {
                    child.stderr.setEncoding('utf8');
                    child.stderr.pipe(process.stderr);
                }
                // Now wait for the server to have listened on `$PORT`, after which we
                // will ProxyPass any requests to that development server that come in
                // for this builder.
                try {
                    await promise_timeout_1.timeout(new Promise(resolve => {
                        const checkForPort = (data) => {
                            // Check the logs for the URL being printed with the port number
                            // (i.e. `http://localhost:47521`).
                            if (data.indexOf(`:${devPort}`) !== -1) {
                                resolve();
                            }
                        };
                        if (child.stdout) {
                            child.stdout.on('data', checkForPort);
                        }
                        if (child.stderr) {
                            child.stderr.on('data', checkForPort);
                        }
                    }), 5 * 60 * 1000);
                }
                catch (err) {
                    throw new Error(`Failed to detect a server running on port ${devPort}.\nDetails: https://err.sh/zeit/now-builders/now-static-build-failed-to-detect-a-server`);
                }
                console.log('Detected dev server for %j', entrypoint);
            }
            let srcBase = mountpoint.replace(/^\.\/?/, '');
            if (srcBase.length > 0) {
                srcBase = `/${srcBase}`;
            }
            if (framework && framework.defaultRoutes) {
                for (const route of framework.defaultRoutes) {
                    routes.push(getDevRoute(srcBase, devPort, route));
                }
            }
            routes.push(getDevRoute(srcBase, devPort, {
                src: '/(.*)',
                dest: '/$1',
            }));
        }
        else {
            if (meta.isDev) {
                console.log(`WARN: "${devScript}" script is missing from package.json`);
                console.log('See the local development docs: https://zeit.co/docs/v2/deployments/official-builders/static-build-now-static-build/#local-development');
            }
            const buildScript = getCommand(pkg, 'build', config);
            console.log(`Running "${buildScript}" script in "${entrypoint}"`);
            const found = await build_utils_1.runPackageJsonScript(entrypointDir, buildScript, spawnOpts);
            if (!found) {
                throw new Error(`Missing required "${buildScript}" script in "${entrypoint}"`);
            }
            if (framework) {
                const outputDirPrefix = path_1.default.join(workPath, path_1.default.dirname(entrypoint));
                const outputDirName = await framework.getOutputDirName(outputDirPrefix);
                distPath = path_1.default.join(outputDirPrefix, outputDirName);
            }
            validateDistDir(distPath, meta.isDev, config);
            output = await build_utils_1.glob('**', distPath, mountpoint);
            if (framework && framework.defaultRoutes) {
                routes.push(...framework.defaultRoutes);
            }
        }
        const watch = [path_1.default.join(mountpoint.replace(/^\.\/?/, ''), '**/*')];
        return { routes, watch, output };
    }
    if (!config.zeroConfig && entrypointName.endsWith('.sh')) {
        console.log(`Running build script "${entrypoint}"`);
        const nodeVersion = await build_utils_1.getNodeVersion(entrypointDir);
        const spawnOpts = build_utils_1.getSpawnOptions(meta, nodeVersion);
        await build_utils_1.runShellScript(path_1.default.join(workPath, entrypoint), [], spawnOpts);
        validateDistDir(distPath, meta.isDev, config);
        return build_utils_1.glob('**', distPath, mountpoint);
    }
    let message = `Build "src" is "${entrypoint}" but expected "package.json"`;
    if (!config.zeroConfig) {
        message += ' or "build.sh"';
    }
    throw new Error(message);
}
exports.build = build;
