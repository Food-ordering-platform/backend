const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ['<rootDir>/src/tests/singleton.ts'],
  roots: ["<rootDir>/src"],
  transform: {
    ...tsJestTransformCfg,
  },
  modulePathIgnorePatterns: ["<rootDir>/dist/"],

  
};