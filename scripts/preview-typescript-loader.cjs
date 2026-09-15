const ts = require('typescript');
module.exports = function (source) {
  return ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
};
