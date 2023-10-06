#! /usr/bin/env node

import fs from "fs";
import readline from "readline";
import inquirer from "inquirer";
import { execSync } from "child_process";
import parser from "@babel/parser";
import traverse from "@babel/traverse";
import generator from "@babel/generator";
import boxen from "boxen";

const targetFile = "tailwind.config.js";
const pluginToAdd = "daisyui";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const addPluginToConfig = () => {
  try {
    const targetCode = fs.readFileSync(targetFile, "utf-8");
    const ast = parser.parse(targetCode, { sourceType: "module" });

    let foundPluginsArray = false;

    traverse.default(ast, {
      AssignmentExpression(path) {
        if (
          path.node.left.type === "MemberExpression" &&
          path.node.left.object.name === "module" &&
          path.node.left.property.name === "exports"
        ) {
          if (path.node.right.type === "ObjectExpression") {
            const pluginsProperty = path.node.right.properties.find(
              (prop) => prop.key.name === "plugins"
            );
            if (pluginsProperty) {
              const pluginsArray = pluginsProperty.value;
              if (pluginsArray.elements) {
                const pluginNames = pluginsArray.elements.map(
                  (el) => el.arguments[0].value
                );
                if (!pluginNames.includes(pluginToAdd)) {
                  pluginsArray.elements.push(
                    parser.parse(`require("${pluginToAdd}")`).program.body[0]
                      .expression
                  );
                }
              } else {
                pluginsArray.elements = [
                  parser.parse(`require("${pluginToAdd}")`).program.body[0]
                    .expression,
                ];
              }
            } else {
              path.node.right.properties.push({
                type: "ObjectProperty",
                key: { type: "Identifier", name: "plugins" },
                value: parser.parse(`[require("${pluginToAdd}")]`).program
                  .body[0].expression,
              });
            }
            foundPluginsArray = true;
          }
        }
      },
    });

    if (!foundPluginsArray) {
      const pluginsArrayNode = parser.parse(
        `plugins: [require("${pluginToAdd}")]`
      ).program.body[0].expression;
      const properties = ast.program.body[0].expression.right.properties;
      if (properties.length > 0) {
        const lastProperty = properties[properties.length - 1];
        lastProperty.value = {
          type: "ArrayExpression",
          elements: [
            parser.parse(`require("${pluginToAdd}")`).program.body[0]
              .expression,
          ],
        };
      } else {
        properties.push({
          type: "ObjectProperty",
          key: { type: "Identifier", name: "plugins" },
          value: pluginsArrayNode,
        });
      }
    }

    const updatedCode = generator.default(ast, {}, targetCode).code;
    fs.writeFileSync(targetFile, updatedCode, "utf-8");

    execSync("npm i -D daisyui@latest --silent", { stdio: "inherit" });
    process.stdout.write("Installed daisyUI");

    console.log(`\nAdded ${pluginToAdd} to ${targetFile}\n`);
    console.log(`✅ Done.\n`);
    console.log(`📘 How to use daisyUI: https://daisyui.com/docs/use/`);

    if (!hadTailwindConfig) {
      showHelp();
    }
  } catch (error) {
    execSync("npm i -D daisyui@latest --silent", { stdio: "inherit" });
    console.log("Installed daisyUI\n");
    console.error(
      `❌ Could not find ${targetFile} file.
   Please config manually:
   https://daisyui.com/docs/install/`
    );
  }
};

const showHelp = () => {
  console.log("");
  console.log(
    boxen(
      `📌 Things to do with a new Tailwind CSS setup:

1. Add the paths to all template files in /tailwind.config.js:
   content: ["./src/**/*.{html,js}"],\n
2. Generate your CSS:
   npx tailwindcss -o tailwind.css --watch\n
3. Put the CSS in your HTML file:
   <link rel="stylesheet" href="/tailwind.css" />

Read more: https://tailwindcss.com/docs/installation'`,
      { padding: 1, borderStyle: "round" }
    )
  );
};

console.log("\n⏳ Initializing daisyUI…\n");
let hadTailwindConfig = false;
inquirer
  .prompt([
    {
      type: "list",
      name: "questionToSetupTailwind",
      message: "Do you want to setup Tailwind CSS first?",
      choices: [
        "No need. I already have Tailwind",
        "Yes. Setup Tailwind first",
      ],
    },
  ])
  .then((answers) => {
    console.log("\n");
    if (answers.questionToSetupTailwind === "Yes. Setup Tailwind first") {
      execSync("npm i -D tailwindcss@latest --silent", { stdio: "inherit" });
      process.stdout.write("Installed Tailwind CSS");

      execSync("npx tailwindcss init", { stdio: "inherit" });

      addPluginToConfig();
    }
    if (
      answers.questionToSetupTailwind === "No need. I already have Tailwind"
    ) {
      hadTailwindConfig = true;
      addPluginToConfig();
    }
  });
