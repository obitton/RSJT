const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const sharedSourceRoot = path.resolve(__dirname, "../../packages/shared/src");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    context.originModulePath.startsWith(sharedSourceRoot) &&
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js")
  ) {
    return context.resolveRequest(
      context,
      moduleName.replace(/\.js$/, ".ts"),
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
