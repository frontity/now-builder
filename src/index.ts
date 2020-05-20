import path from "path";
import { existsSync, readFileSync, statSync, readdirSync } from "fs";
import {
  glob,
  download,
  runNpmInstall,
  runPackageJsonScript,
  getNodeVersion,
  getSpawnOptions,
  createLambda,
  Route,
  BuildOptions,
  Config,
  FileFsRef,
  Lambda
} from "@now/build-utils";

interface PackageJson {
  scripts?: {
    [key: string]: string;
  };
  dependencies?: {
    [key: string]: string;
  };
  devDependencies?: {
    [key: string]: string;
  };
}

interface Output {
  [name: string]: FileFsRef | Lambda;
}

function validateDistDir(
  distDir: string,
  isDev: boolean | undefined,
  config: Config
): void {
  const distDirName = path.basename(distDir);
  const exists = (): boolean => existsSync(distDir);
  const isDirectory = (): boolean => statSync(distDir).isDirectory();
  const isEmpty = (): boolean => readdirSync(distDir).length === 0;

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
    throw new Error(
      `Build failed because distDir is not a directory: "${distDirName}".${info}`
    );
  }

  if (isEmpty()) {
    throw new Error(
      `Build failed because distDir is empty: "${distDirName}".${info}`
    );
  }
}

function getCommand(pkg: PackageJson, cmd: string): string {
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

export const version = 2;

export async function build({
  files,
  entrypoint,
  workPath,
  config,
  meta = {}
}: BuildOptions): Promise<{ routes: object; output: Output }> {
  console.log("Downloading user files...");
  await download(files, workPath, meta);

  const mountpoint = path.dirname(entrypoint);
  const entrypointDir = path.join(workPath, mountpoint);

  const distPath = path.join(
    workPath,
    mountpoint,
    (config && (config.distDir as string)) || "build"
  );

  const entrypointName = path.basename(entrypoint);

  if (entrypointName === "package.json") {
    const pkgPath = path.join(workPath, entrypoint);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

    const minNodeRange: string | undefined = undefined;

    const prefix = mountpoint === "." ? "" : `/${mountpoint}`;

    const routes: Route[] = [
      {
        src: `${prefix}/static/(.*)`,
        headers: { "cache-control": "public,max-age=31536000,immutable" },
        dest: `/static/$1`
      },
      { src: `${prefix}/robots.txt`, dest: "robots.txt" },
      { src: `${prefix}/favicon.ico`, dest: "favicon.ico" },
      {
        src: `${prefix}($|/.*)`,
        headers: { "cache-control": "s-maxage=1,stale-while-revalidate" },
        dest: `/server.js`
      }
    ];

    const nodeVersion = await getNodeVersion(entrypointDir, minNodeRange);
    const spawnOpts = getSpawnOptions(meta, nodeVersion);

    await runNpmInstall(entrypointDir, ["--prefer-offline"], spawnOpts);

    const buildScript = getCommand(pkg, "build");
    console.log(`Running "${buildScript}" script in "${entrypoint}"`);

    const found = await runPackageJsonScript(
      entrypointDir,
      buildScript,
      spawnOpts
    );

    if (!found) {
      throw new Error(
        `Missing required "${buildScript}" script in "${entrypoint}"`
      );
    }

    validateDistDir(distPath, meta.isDev, config);
    const statics = await glob("static/**", distPath);
    const server = await glob("server.js", distPath);
    const robotsTxt = await glob('robots.txt', workPath);
    const favicon = await glob("favicon.ico", workPath);

    const launcherFiles = {
      "now__bridge.js": new FileFsRef({
        fsPath: require("@now/node-bridge")
      }),
      "now__launcher.js": new FileFsRef({
        fsPath: path.join(__dirname, "launcher.js")
      })
    };

    const lambda = await createLambda({
      runtime: "nodejs12.x",
      handler: "now__launcher.launcher",
      files: {
        ...launcherFiles,
        "index.js": new FileFsRef({
          fsPath: server["server.js"].fsPath
        })
      }
    });

    const output = {
      ...statics,
      ...robotsTxt,
      ...favicon,
      "server.js": lambda
    };

    console.log("Finished.");

    return { routes, output };
  }

  throw new Error(`Build "src" is "${entrypoint}" but expected "package.json"`);
}
