"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const build_utils_1 = require("@now/build-utils");
function validateDistDir(distDir, isDev, config) {
    const distDirName = path_1.default.basename(distDir);
    const exists = () => fs_1.existsSync(distDir);
    const isDirectory = () => fs_1.statSync(distDir).isDirectory();
    const isEmpty = () => fs_1.readdirSync(distDir).length === 0;
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
function getCommand(pkg, cmd, { zeroConfig }) {
    // The `dev` script can be `now dev`
    const nowCmd = `now-${cmd}`;
    if (!zeroConfig && cmd === "dev") {
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
async function build({ files, entrypoint, workPath, config, meta = {} }) {
    console.log("Downloading user files...");
    await build_utils_1.download(files, workPath, meta);
    const mountpoint = path_1.default.dirname(entrypoint);
    const entrypointDir = path_1.default.join(workPath, mountpoint);
    let distPath = path_1.default.join(workPath, path_1.default.dirname(entrypoint), (config && config.distDir) || "build");
    const entrypointName = path_1.default.basename(entrypoint);
    if (entrypointName === "package.json") {
        const pkgPath = path_1.default.join(workPath, entrypoint);
        const pkg = JSON.parse(fs_1.readFileSync(pkgPath, "utf8"));
        let output = {};
        let minNodeRange = undefined;
        const routes = [
            {
                src: '/static/(.*)',
                headers: { 'cache-control': 's-maxage=31536000, immutable' },
                dest: '/static/$1',
            },
        ];
        const nodeVersion = await build_utils_1.getNodeVersion(entrypointDir, minNodeRange);
        const spawnOpts = build_utils_1.getSpawnOptions(meta, nodeVersion);
        await build_utils_1.runNpmInstall(entrypointDir, ["--prefer-offline"], spawnOpts);
        const buildScript = getCommand(pkg, "build", config);
        console.log(`Running "${buildScript}" script in "${entrypoint}"`);
        const found = await build_utils_1.runPackageJsonScript(entrypointDir, buildScript, spawnOpts);
        if (!found) {
            throw new Error(`Missing required "${buildScript}" script in "${entrypoint}"`);
        }
        validateDistDir(distPath, meta.isDev, config);
        output = await build_utils_1.glob("**", distPath, mountpoint);
        const watch = [path_1.default.join(mountpoint.replace(/^\.\/?/, ""), "**/*")];
        return { routes, watch, output };
    }
    if (!config.zeroConfig && entrypointName.endsWith(".sh")) {
        console.log(`Running build script "${entrypoint}"`);
        const nodeVersion = await build_utils_1.getNodeVersion(entrypointDir);
        const spawnOpts = build_utils_1.getSpawnOptions(meta, nodeVersion);
        await build_utils_1.runShellScript(path_1.default.join(workPath, entrypoint), [], spawnOpts);
        validateDistDir(distPath, meta.isDev, config);
        return build_utils_1.glob("**", distPath, mountpoint);
    }
    let message = `Build "src" is "${entrypoint}" but expected "package.json"`;
    if (!config.zeroConfig) {
        message += ' or "build.sh"';
    }
    throw new Error(message);
}
exports.build = build;
