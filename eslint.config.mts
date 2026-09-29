import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
    tseslint.configs.recommended,
    {
        files: ["**/*.{js,ts}"],
        ignores: ["**/*.config.{js,ts}", "swagger.ts"],
        languageOptions: {
            globals: globals.node,
            parserOptions: {
                projectService: true,
            },
        },
        rules: {
            // force await so the execution order is made sure to be proper
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/require-await": "error",
            // for global variables like NodeJS
            "no-undef": "off",
            // for network room, colyseus won't expose the instance when creating a room
            "@typescript-eslint/no-this-alias": "off",
            // for anonymous structures
            "@typescript-eslint/no-explicit-any": "off",
            // unused arguments
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "caughtErrors": "all",
                    "caughtErrorsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "ignoreRestSiblings": true
                }
            ]
        },
    },
]);
