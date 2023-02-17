/*
Copyright 2018 - 2022 The Alephium Authors
This file is part of the alephium project.

The library is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

The library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with the library. If not, see <http://www.gnu.org/licenses/>.
*/

import { node, Project, Script, Contract, EventSig, SystemEventSig } from '@alephium/web3'
import * as prettier from 'prettier'
import path from 'path'
import fs from 'fs'

const header = `/* Autogenerated file. Do not edit manually. */\n/* tslint:disable */\n/* eslint-disable */\n\n`

function array(str: string, size: number): string {
  const result = Array(size).fill(str).join(', ')
  return `[${result}]`
}

function parseArrayType(tpe: string): string {
  const ignored = '[;]'
  const tokens: string[] = []
  let acc = ''
  for (let index = 0; index < tpe.length; index++) {
    if (!ignored.includes(tpe.charAt(index))) {
      acc = acc + tpe.charAt(index)
    } else if (acc !== '') {
      tokens.push(acc)
      acc = ''
    }
  }
  const baseTsType = toTsType(tokens[0])
  const sizes = tokens.slice(1).map((str) => parseInt(str))
  return sizes.reduce((acc, size) => array(acc, size), baseTsType)
}

function toTsType(ralphType: string): string {
  switch (ralphType) {
    case 'U256':
    case 'I256':
      return 'bigint'
    case 'Bool':
      return 'boolean'
    case 'Address':
    case 'ByteVec':
      return 'HexString'
    default: // array type
      return parseArrayType(ralphType)
  }
}

function formatParameters(fieldsSig: { names: string[]; types: string[] }): string {
  return fieldsSig.names.map((name, idx) => `${name}: ${toTsType(fieldsSig.types[`${idx}`])}`).join(', ')
}

function genCallMethod(contractName: string, functionSig: node.FunctionSig): string {
  if (!functionSig.isPublic || functionSig.returnTypes.length === 0) {
    return ''
  }
  const funcName = functionSig.name.charAt(0).toUpperCase() + functionSig.name.slice(1)
  const funcHasArgs = functionSig.paramNames.length > 0
  const params = funcHasArgs
    ? `params: CallContractParams<{${formatParameters({
        names: functionSig.paramNames,
        types: functionSig.paramTypes
      })}}>`
    : `params?: Omit<CallContractParams<{}>, 'args'>`
  const tsReturnTypes = functionSig.returnTypes.map((tpe) => toTsType(tpe))
  const retType =
    tsReturnTypes.length === 0
      ? `CallContractResult<null>`
      : tsReturnTypes.length === 1
      ? `CallContractResult<${tsReturnTypes[0]}>`
      : `CallContractResult<[${tsReturnTypes.join(', ')}]>`
  const callParams = funcHasArgs ? 'params' : 'params === undefined ? {} : params'
  return `
    async call${funcName}Method(${params}): Promise<${retType}> {
      return callMethod(${contractName}, this, "${functionSig.name}", ${callParams})
    }
  `
}

function getInstanceName(contract: Contract): string {
  return `${contract.name}Instance`
}

function genAttach(instanceName: string): string {
  return `
  at(address: string): ${instanceName} {
    return new ${instanceName}(address)
  }
  `
}

function contractTypes(contractName: string): string {
  return `${contractName}`
}

function contractFieldType(contract: Contract): string {
  const hasFields = contract.fieldsSig.names.length > 0
  return hasFields ? `${contractTypes(contract.name)}.Fields` : '{}'
}

function genFetchState(contract: Contract): string {
  return `
  async fetchState(): Promise<${contractTypes(contract.name)}.State> {
    return fetchContractState(${contract.name}, this)
  }
  `
}

function getEventType(event: EventSig): string {
  return event.name + 'Event'
}

function genEventType(event: EventSig): string {
  if (event.fieldNames.length === 0) {
    return `export type ${getEventType(event)} = Omit<ContractEvent, 'fields'>`
  }
  const fieldsType = `{${formatParameters({ names: event.fieldNames, types: event.fieldTypes })}}`
  return `export type ${getEventType(event)} = ContractEvent<${fieldsType}>`
}

function genSubscribeSystemEvent(event: SystemEvent): string {
  return `
    subscribe${event.eventSig.name}Event(options: SubscribeOptions<${event.eventType}>, fromCount?: number): EventSubscription {
      return subscribe${event.eventSig.name}Event(this, options, fromCount)
    }
  `
}

function genSubscribeEvent(contractName: string, event: EventSig): string {
  const eventType = getEventType(event)
  const scopedEventType = `${contractTypes(contractName)}.${eventType}`
  return `
    subscribe${eventType}(options: SubscribeOptions<${scopedEventType}>, fromCount?: number): EventSubscription {
      return subscribeContractEvent(${contractName}.contract, this, options, "${event.name}", fromCount)
    }
  `
}

function genSubscribeAllEvents(contract: Contract, systemEvents: SystemEvent[]): string {
  const contractEventTypes = contract.eventsSig.map((e) => `${contractTypes(contract.name)}.${getEventType(e)}`)
  const systemEventTypes = systemEvents.map((e) => e.eventType)
  const eventTypes = contractEventTypes.concat(systemEventTypes).join(' | ')
  return `
    subscribeAllEvents(options: SubscribeOptions<${eventTypes}>, fromCount?: number): EventSubscription {
      return subscribeAllEvents(${contract.name}.contract, this, options, fromCount)
    }
  `
}

function genContractStateType(contract: Contract): string {
  if (contract.fieldsSig.names.length === 0) {
    return `export type State = Omit<ContractState<any>, 'fields'>`
  }
  return `
    export type Fields = {
      ${formatParameters(contract.fieldsSig)}
    }

    export type State = ContractState<Fields>
  `
}

function genTestMethod(contract: Contract, functionSig: node.FunctionSig): string {
  const funcName = functionSig.name.charAt(0).toUpperCase() + functionSig.name.slice(1)
  const funcHasArgs = functionSig.paramNames.length > 0
  const contractHasFields = contract.fieldsSig.names.length > 0
  const argsType = funcHasArgs
    ? `{${formatParameters({ names: functionSig.paramNames, types: functionSig.paramTypes })}}`
    : 'never'
  const fieldsType = contractHasFields ? `${contractFieldType(contract)}` : 'never'
  const params =
    funcHasArgs && contractHasFields
      ? `params: TestContractParams<${fieldsType}, ${argsType}>`
      : funcHasArgs
      ? `params: Omit<TestContractParams<${fieldsType}, ${argsType}>, 'initialFields'>`
      : contractHasFields
      ? `params: Omit<TestContractParams<${fieldsType}, ${argsType}>, 'testArgs'>`
      : `params?: Omit<TestContractParams<${fieldsType}, ${argsType}>, 'testArgs' | 'initialFields'>`
  const tsReturnTypes = functionSig.returnTypes.map((tpe) => toTsType(tpe))
  const retType =
    tsReturnTypes.length === 0
      ? `TestContractResult<null>`
      : tsReturnTypes.length === 1
      ? `TestContractResult<${tsReturnTypes[0]}>`
      : `TestContractResult<[${tsReturnTypes.join(', ')}]>`
  const callParams = funcHasArgs || contractHasFields ? 'params' : 'params === undefined ? {} : params'
  return `
    async test${funcName}Method(${params}): Promise<${retType}> {
      return testMethod(this, "${functionSig.name}", ${callParams})
    }
  `
}

type SystemEvent = {
  eventSig: SystemEventSig
  eventIndex: number
  eventType: string
}

function genContract(contract: Contract, artifactRelativePath: string): string {
  const projectArtifact = Project.currentProject.projectArtifact
  const contractInfo = projectArtifact.infos.get(contract.name)
  if (contractInfo === undefined) {
    throw new Error(`Contract info does not exist: ${contract.name}`)
  }
  const systemEvents: SystemEvent[] = [
    {
      eventSig: Contract.ContractCreatedEvent,
      eventIndex: Contract.ContractCreatedEventIndex,
      eventType: 'ContractCreatedEvent'
    },
    {
      eventSig: Contract.ContractDestroyedEvent,
      eventIndex: Contract.ContractDestroyedEventIndex,
      eventType: 'ContractDestroyedEvent'
    }
  ]
  const source = `
    ${header}

    import {
      Address, Contract, ContractState, TestContractResult, HexString, ContractFactory,
      SubscribeOptions, EventSubscription, CallContractParams, CallContractResult,
      TestContractParams, ContractEvent, subscribeContractCreatedEvent, subscribeContractDestroyedEvent, subscribeContractEvent, subscribeAllEvents, testMethod, callMethod, fetchContractState,
      ContractCreatedEvent, ContractDestroyedEvent, ContractInstance
    } from '@alephium/web3'
    import { default as ${contract.name}ContractJson } from '../${artifactRelativePath}'

    // Custom types for the contract
    export namespace ${contractTypes(contract.name)} {
      ${genContractStateType(contract)}
      ${contract.eventsSig.map((e) => genEventType(e)).join('\n')}
    }

    class Factory extends ContractFactory<${contract.name}Instance, ${contractFieldType(contract)}> {
      ${genAttach(getInstanceName(contract))}
      ${contract.functions.map((f) => genTestMethod(contract, f)).join('\n')}
    }

    // Use this object to test and deploy the contract
    export const ${contract.name} = new Factory(Contract.fromJson(
      ${contract.name}ContractJson,
      '${contractInfo.bytecodeDebugPatch}',
      '${contractInfo.codeHashDebug}',
    ))

    // Use this class to interact with the blockchain
    export class ${contract.name}Instance extends ContractInstance {
      constructor(address: Address) {
        super(address)
      }

      ${genFetchState(contract)}
      ${systemEvents.map((e) => genSubscribeSystemEvent(e)).join('\n')}
      ${contract.eventsSig.map((e) => genSubscribeEvent(contract.name, e)).join('\n')}
      ${genSubscribeAllEvents(contract, systemEvents)}
      ${contract.functions.map((f) => genCallMethod(contract.name, f)).join('\n')}
    }
`
  return prettier.format(source, { parser: 'typescript' })
}

function genScript(script: Script): string {
  console.log(`Generating code for script ${script.name}`)
  const usePreapprovedAssets = script.functions[0].usePreapprovedAssets
  const fieldsType = script.fieldsSig.names.length > 0 ? `{${formatParameters(script.fieldsSig)}}` : '{}'
  const paramsType = usePreapprovedAssets
    ? `ExecuteScriptParams<${fieldsType}>`
    : `Omit<ExecuteScriptParams<${fieldsType}>, 'attoAlphAmount' | 'tokens'>`
  return `
    export namespace ${script.name} {
      export async function execute(signer: SignerProvider, params: ${paramsType}): Promise<ExecuteScriptResult> {
        const signerParams = await script.txParamsForExecution(signer, params)
        return await signer.signAndSubmitExecuteScriptTx(signerParams)
      }

      export const script = Script.fromJson(${script.name}ScriptJson)
    }
  `
}

function genScripts(outDir: string, artifactDir: string, exports: string[]) {
  exports.push('./scripts')
  const scriptPath = path.join(outDir, 'scripts.ts')
  const scripts = Array.from(Project.currentProject.scripts.values())
  const importArtifacts = Array.from(scripts)
    .map((s) => {
      const artifactPath = s.sourceInfo.getArtifactPath(artifactDir)
      const artifactRelativePath = path.relative(artifactDir, artifactPath)
      return `import { default as ${s.artifact.name}ScriptJson } from '../${artifactRelativePath}'`
    })
    .join('\n')
  const scriptsSource = scripts.map((s) => genScript(s.artifact)).join('\n')
  const source = `
    ${header}

    import {
      ExecuteScriptParams,
      ExecuteScriptResult,
      Script,
      SignerProvider,
      HexString
    } from '@alephium/web3'
    ${importArtifacts}

    ${scriptsSource}
  `
  const formatted = prettier.format(source, { parser: 'typescript' })
  fs.writeFileSync(scriptPath, formatted, 'utf8')
}

function genIndexTs(outDir: string, exports: string[]) {
  const indexPath = path.join(outDir, 'index.ts')
  const exportStatements = exports.map((e) => `export * from "${e}"`).join('\n')
  const source = prettier.format(header + exportStatements, { parser: 'typescript' })
  fs.writeFileSync(indexPath, source, 'utf8')
}

function genContracts(outDir: string, artifactDir: string, exports: string[]) {
  Array.from(Project.currentProject.contracts.values()).forEach((c) => {
    console.log(`Generating code for contract ${c.artifact.name}`)
    exports.push(`./${c.artifact.name}`)
    const filename = `${c.artifact.name}.ts`
    const sourcePath = path.join(outDir, filename)
    const artifactPath = c.sourceInfo.getArtifactPath(artifactDir)
    const artifactRelativePath = path.relative(artifactDir, artifactPath)
    const sourceCode = genContract(c.artifact, artifactRelativePath)
    fs.writeFileSync(sourcePath, sourceCode, 'utf8')
  })
}

export function codegen(artifactDir: string) {
  const outDirTemp = path.join(artifactDir, 'ts')
  const outDir = path.isAbsolute(outDirTemp) ? outDirTemp : path.resolve(outDirTemp)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const exports: string[] = []
  try {
    genContracts(outDir, artifactDir, exports)
    genScripts(outDir, artifactDir, exports)
    genIndexTs(outDir, exports)
  } catch (error) {
    console.log(`Failed to generate code: ${error}`)
  }
}