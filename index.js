#! /usr/bin/env node

import fs from "fs";
import boxen from "boxen";
import inquirer from "inquirer";
import { promisify } from "util";
import parser from "@babel/parser";
import traverse from "@babel/traverse";
import generator from "@babel/generator";
import { execSync } from "child_process";

const writeFileAsync = promisify(fs.writeFile);
const targetFile = "tailwind.config.js";
const pluginToAdd = "daisyui";

const setupTailwind = () => {
  execSync("npm i -D tailwindcss@latest --silent", { stdio: "inherit" });
  console.log("✅ Installed Tailwind CSS");
  execSync("npx tailwindcss init", { stdio: [] });
  console.log("✅ Initialized tailwind.config.js");
  const filePath = "./tailwind.css";
  const fileContent = `@tailwind base;
@tailwind components;
@tailwind utilities;`;

  writeFileAsync(filePath, fileContent);
  console.log("✅ Created tailwind.css");
};
const setupPostcss = () => {
  execSync("npm install -D postcss@latest autoprefixer@latest --silent", {
    stdio: "inherit",
  });
  console.log("✅ Installed PostCSS and Autoprefixer");

  const filePath = "./postcss.config.js";
  const fileContent = `module.exports = {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    }
  }`;

  writeFileAsync(filePath, fileContent);
  console.log("✅ Created postcss.config.js");
};
const setupDaisy = () => {
  execSync("npm i -D daisyui@latest --silent", { stdio: "inherit" });
  process.stdout.write("✅ Installed daisyUI");
};

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

    console.log(`\n✅ Added ${pluginToAdd} to ${targetFile}\n`);
    console.log(`📘 How to use daisyUI: https://daisyui.com/docs/use/`);

    if (chosenSetup === "tailwind") {
      showTailwindSetupHelp();
    }
    if (chosenSetup === "postcss") {
      showPostcssSetupHelp();
    }
  } catch (error) {
    console.error(
      `\n❌ Could not find ${targetFile} file.
   Please config manually:
   https://daisyui.com/docs/install/`
    );
  }
};

const showTailwindSetupHelp = () => {
  console.log("");
  console.log(
    boxen(
      `📌 Things to do with a new Tailwind CSS setup:

1. Add the paths to all template files in /tailwind.config.js:
   content: ["./src/**/*.{html,js}"],\n
2. Generate your CSS:
   npx tailwindcss -i tailwind.css -o output.css\n
3. Put the CSS in your HTML file:
   <link rel="stylesheet" href="/output.css" />

Read more: https://tailwindcss.com/docs/installation`,
      { padding: 1, borderStyle: "round" }
    )
  );
};

const showPostcssSetupHelp = () => {
  console.log("");
  console.log(
    boxen(
      `📌 Things to do with a new Tailwind CSS setup:

1. Add the paths to all template files in /tailwind.config.js:
   content: ["./src/**/*.{html,js}"],\n
2. Generate your CSS:
   npx postcss-cli tailwind.css -o output.css\n
3. Put the CSS in your HTML file:
   <link rel="stylesheet" href="/output.css" />

Read more: https://tailwindcss.com/docs/installation`,
      { padding: 1, borderStyle: "round" }
    )
  );
};

console.log("\n🌼 Initializing daisyUI…\n");
let chosenSetup = "new";
inquirer
  .prompt([
    {
      type: "list",
      name: "questionToSetTailwind",
      message: "Do you want to setup Tailwind CSS first?",
      choices: [
        "No need. I already have Tailwind",
        "Yes. Setup Tailwind first",
        "Yes. Setup Tailwind first (with PostCSS)",
      ],
    },
  ])
  .then((answers) => {
    console.log("\n");
    if (answers.questionToSetTailwind === "Yes. Setup Tailwind first") {
      chosenSetup = "tailwind";
      setupTailwind();
      setupDaisy();
      addPluginToConfig();
    }
    if (
      answers.questionToSetTailwind ===
      "Yes. Setup Tailwind first (with PostCSS)"
    ) {
      chosenSetup = "postcss";
      setupTailwind();
      setupPostcss();
      setupDaisy();
      addPluginToConfig();
    }
    if (answers.questionToSetTailwind === "No need. I already have Tailwind") {
      setupDaisy();
      addPluginToConfig();
    }
  });
