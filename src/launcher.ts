/* eslint-disable @typescript-eslint/no-var-requires */

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV =
    process.env.NOW_REGION === "dev1" ? "development" : "production";
}

const { Server } = require("http");
const { Bridge } = require("./now__bridge");
const frontity = require("./index").default;

const server = new Server(frontity);
const bridge = new Bridge(server);
bridge.listen();

exports.launcher = bridge.launcher;
