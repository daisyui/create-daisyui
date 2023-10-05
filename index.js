#! /usr/bin/env node

const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;

const targetFile = "tailwind.config.js";
const pluginToAdd = "daisyui";

const targetCode = fs.readFileSync(targetFile, "utf-8");
const ast = parser.parse(targetCode, { sourceType: "module" });

let foundPluginsArray = false;

traverse(ast, {
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
            value: parser.parse(`[require("${pluginToAdd}")]`).program.body[0]
              .expression,
          });
        }
        foundPluginsArray = true;
      }
    }
  },
});

if (!foundPluginsArray) {
  const pluginsArrayNode = parser.parse(`plugins: [require("${pluginToAdd}")]`)
    .program.body[0].expression;
  const properties = ast.program.body[0].expression.right.properties;
  if (properties.length > 0) {
    const lastProperty = properties[properties.length - 1];
    lastProperty.value = {
      type: "ArrayExpression",
      elements: [
        parser.parse(`require("${pluginToAdd}")`).program.body[0].expression,
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

const updatedCode = generator(ast, {}, targetCode).code;
fs.writeFileSync(targetFile, updatedCode, "utf-8");
console.log(`Added ${pluginToAdd} to ${targetFile}`);
