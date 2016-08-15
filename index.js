'use strict'

const parser = require('wast-parser')
const codegen = require('wast-codegen')
const AST = require('wast-graph')
const fs = require('fs')

const imports = [
  'memcpy.wast',
  'memset.wast'
]

/*
 * Add nodes to the (module) node.
 */
function addToModule (rootNode, json) {
  const body = rootNode.get('body')
  for (let item of body.edges) {
    if (item[1].kind === 'module') {
      item[1].get('body').push(json)
    }
  }
}

module.exports.cleanupWAST = function (wast) {
  const astJSON = parser.parse(wast)
  const transformedJSON = module.exports.cleanupJSON(astJSON)
  return codegen.generate(transformedJSON, 2)
}

module.exports.cleanupJSON = function (json) {
  const astGraph = new AST(json)

  /*
   * Include the "standard library"
   */
  for (const item of imports) {
    const tmp = parser.parse(fs.readFileSync(item).toString())
    addToModule(astGraph, tmp.body[0])
  }

  const module = astGraph.get('body').get(0).get('body')
  for (const item of module.edges) {
    /*
     * Translate "env:ethereum_*" style imports to "ethereum:*" and remove the others.
     */
    if (item[1].kind === 'import') {
      if (/^ethereum_/.test(item[1].get('funcName').value.value)) {
        item[1].get('modName').value.value = 'ethereum'
        item[1].get('funcName').value.value = item[1].get('funcName').value.value.replace('ethereum_', '')
      } else {
        module.delVertex(item[1])
      }
    }

    /*
     * Remove unneeded exports.
     */
    if (item[1].kind === 'export') {
      const name = item[1].get('name').value.value

      if ((name !== 'main') && (name !== 'memory')) {
        module.delVertex(item[1])
      }
    }
  }

  return astGraph.toJSON()
}
