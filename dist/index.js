"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.build = exports.version = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const build_utils_1 = require("@now/build-utils");
function validateDistDir(distDir, isDev, config) {
    const distDirName = path_1.default.basename(distDir);
    const exists = () => (0, fs_1.existsSync)(distDir);
    const isDirectory = () => (0, fs_1.statSync)(distDir).isDirectory();
    const isEmpty = () => (0, fs_1.readdirSync)(distDir).length === 0;
    const hash = isDev
        ? "#local-development"
        : "#configuring-the-build-output-directory";
    const docsUrl = `https://zeit.co/docs/v2/deployments/official-builders/static-build-now-static-build${hash}`;
    const info = config.zeroConfig
        ? "\nMore details: https://zeit.co/docs/v2/advanced/platform/frequently-asked-questions#missing-public-directory"
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
function getCommand(pkg, cmd) {
    const nowCmd = `now-${cmd}`;
    const scripts = (pkg && pkg.scripts) || {};
    if (scripts[nowCmd]) {
        return nowCmd;
    }
    if (scripts[cmd]) {
        return cmd;
    }
    return `npx frontity ${cmd}`;
}
exports.version = 2;
async function build({ files, entrypoint, workPath, config, meta = {}, }) {
    console.log("Downloading user files...");
    await (0, build_utils_1.download)(files, workPath, meta);
    const mountpoint = path_1.default.dirname(entrypoint);
    const entrypointDir = path_1.default.join(workPath, mountpoint);
    const distPath = path_1.default.join(workPath, mountpoint, (config && config.distDir) || "build");
    const entrypointName = path_1.default.basename(entrypoint);
    if (entrypointName === "package.json") {
        const pkgPath = path_1.default.join(workPath, entrypoint);
        const pkg = JSON.parse((0, fs_1.readFileSync)(pkgPath, "utf8"));
        const minNodeRange = undefined;
        const prefix = mountpoint === "." ? "" : `/${mountpoint}`;
        const routes = [
            {
                src: `${prefix}/static/(.*)`,
                headers: { "cache-control": "public,max-age=31536000,immutable" },
                dest: `/static/$1`,
            },
            { src: `${prefix}/favicon.ico`, dest: "favicon.ico" },
            {
                src: `${prefix}($|/.*)`,
                headers: { "cache-control": "s-maxage=1,stale-while-revalidate" },
                dest: `/server.js`,
            },
        ];
        const nodeVersion = await (0, build_utils_1.getNodeVersion)(entrypointDir, minNodeRange);
        const spawnOpts = (0, build_utils_1.getSpawnOptions)(meta, nodeVersion);
        await (0, build_utils_1.runNpmInstall)(entrypointDir, ["--prefer-offline"], spawnOpts);
        const buildScript = getCommand(pkg, "build");
        console.log(`Running "${buildScript}" script in "${entrypoint}"`);
        const found = await (0, build_utils_1.runPackageJsonScript)(entrypointDir, buildScript, spawnOpts);
        if (!found) {
            throw new Error(`Missing required "${buildScript}" script in "${entrypoint}"`);
        }
        validateDistDir(distPath, meta.isDev, config);
        const statics = await (0, build_utils_1.glob)("static/**", distPath);
        const server = await (0, build_utils_1.glob)("server.js", distPath);
        const robotsTxt = await (0, build_utils_1.glob)("robots.txt", workPath);
        const adsTxt = await (0, build_utils_1.glob)("ads.txt", workPath);
        const favicon = await (0, build_utils_1.glob)("favicon.ico", workPath);
        if (!server["server.js"])
            throw new Error("Something went wrong with the build. Please run `npx frontity dev --production` locally to find out.");
        if (robotsTxt["robots.txt"])
            routes.unshift({ src: `${prefix}/robots.txt`, dest: "robots.txt" });
        if (adsTxt["ads.txt"])
            routes.unshift({ src: `${prefix}/ads.txt`, dest: "ads.txt" });
        const launcherFiles = {
            "now__bridge.js": new build_utils_1.FileFsRef({
                fsPath: require("@now/node-bridge"),
            }),
            "now__launcher.js": new build_utils_1.FileFsRef({
                fsPath: path_1.default.join(__dirname, "launcher.js"),
            }),
        };
        const lambda = await (0, build_utils_1.createLambda)({
            runtime: 'nodejs14.x',
            handler: 'now__launcher.launcher',
            files: {
                ...launcherFiles,
                'index.js': new build_utils_1.FileFsRef({
                    fsPath: server['server.js'].fsPath,
                }),
            },
        });
        const output = {
            ...statics,
            ...robotsTxt,
            ...favicon,
            ...adsTxt,
            "server.js": lambda,
        };
        console.log("Finished.");
        console.log(`${process.env}`);
        return { routes, output };
    }
    throw new Error(`Build "src" is "${entrypoint}" but expected "package.json"`);
}
exports.build = build;
