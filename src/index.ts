import path from "path";
import { existsSync, readFileSync, statSync, readdirSync } from "fs";
import {
  glob,
  download,
  runNpmInstall,
  runPackageJsonScript,
  getNodeVersion,
  getSpawnOptions,
  Files,
  Route,
  BuildOptions,
  Config
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

function validateDistDir(
  distDir: string,
  isDev: boolean | undefined,
  config: Config
) {
  const distDirName = path.basename(distDir);
  const exists = () => existsSync(distDir);
  const isDirectory = () => statSync(distDir).isDirectory();
  const isEmpty = () => readdirSync(distDir).length === 0;

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

function getCommand(pkg: PackageJson, cmd: string, { zeroConfig }: Config) {
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

export const version = 2;

export async function build({
  files,
  entrypoint,
  workPath,
  config,
  meta = {}
}: BuildOptions) {
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

    const routes: Route[] = [
      {
        src: `/static/(.*)`,
        headers: { "cache-control": "s-maxage=31536000, immutable" },
        dest: `/static/$1`
      }
    ];

    const nodeVersion = await getNodeVersion(entrypointDir, minNodeRange);
    const spawnOpts = getSpawnOptions(meta, nodeVersion);

    await runNpmInstall(entrypointDir, ["--prefer-offline"], spawnOpts);

    const buildScript = getCommand(pkg, "build", config as Config);
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

    console.log("Mountpoint is: " + JSON.stringify(mountpoint));
    console.log("Routes are: " + JSON.stringify(routes));

    validateDistDir(distPath, meta.isDev, config);
    const output: Files = await glob("**", distPath, mountpoint);

    console.log("Output files are: " + JSON.stringify(output));

    console.log("Finished!");

    return { routes, output };
  }

  throw new Error(`Build "src" is "${entrypoint}" but expected "package.json"`);
}
