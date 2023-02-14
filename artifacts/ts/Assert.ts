/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  web3,
  Address,
  Contract,
  ContractState,
  node,
  binToHex,
  TestContractResult,
  Asset,
  HexString,
  ContractFactory,
  contractIdFromAddress,
  ONE_ALPH,
  groupOfAddress,
  fromApiVals,
  subscribeToEvents,
  SubscribeOptions,
  Subscription,
  EventSubscription,
  randomTxId,
  CallContractParams,
  CallContractResult,
  TestContractParams,
  ContractEvent,
  subscribeEventsFromContract,
  decodeContractCreatedEvent,
  decodeContractDestroyedEvent,
  ContractCreatedEvent,
  ContractDestroyedEvent,
} from "@alephium/web3";
import { default as AssertContractJson } from "../test/assert.ral.json";

export namespace AssertTypes {
  export type State = Omit<ContractState<any>, "fields">;
}

class Factory extends ContractFactory<AssertInstance, {}> {
  at(address: string): AssertInstance {
    return new AssertInstance(address);
  }

  async testTestMethod(
    params?: Omit<TestContractParams<{}, {}>, "testArgs" | "initialFields">
  ): Promise<Omit<TestContractResult, "returns">> {
    const txId = params?.txId ?? randomTxId();
    const apiParams = this.contract.toApiTestContractParams("test", {
      ...params,
      txId: txId,
      testArgs: {},
      initialFields: {},
    });
    const apiResult = await web3
      .getCurrentNodeProvider()
      .contracts.postContractsTestContract(apiParams);
    const testResult = this.contract.fromApiTestContractResult(
      0,
      apiResult,
      txId
    );
    this.contract.printDebugMessages("test", testResult.debugMessages);

    return {
      ...testResult,
    };
  }
}

export const Assert = new Factory(
  Contract.fromJson(
    AssertContractJson,
    "",
    "5bd05924fb9a23ea105df065a8c2dfa463b9ee53cc14a60320140d19dd6151ca"
  )
);

export class AssertInstance {
  readonly address: Address;
  readonly contractId: string;
  readonly groupIndex: number;

  constructor(address: Address) {
    this.address = address;
    this.contractId = binToHex(contractIdFromAddress(address));
    this.groupIndex = groupOfAddress(address);
  }

  async fetchState(): Promise<AssertTypes.State> {
    const contractState = await web3
      .getCurrentNodeProvider()
      .contracts.getContractsAddressState(this.address, {
        group: this.groupIndex,
      });
    const state = Assert.contract.fromApiContractState(contractState);
    return {
      ...state,
    };
  }

  subscribeContractCreatedEvent(
    options: SubscribeOptions<ContractCreatedEvent>,
    fromCount?: number
  ): EventSubscription {
    return subscribeEventsFromContract(
      options,
      this.address,
      -1,
      (event) => {
        return {
          ...decodeContractCreatedEvent(event),
          contractAddress: this.address,
        };
      },
      fromCount
    );
  }

  subscribeContractDestroyedEvent(
    options: SubscribeOptions<ContractDestroyedEvent>,
    fromCount?: number
  ): EventSubscription {
    return subscribeEventsFromContract(
      options,
      this.address,
      -2,
      (event) => {
        return {
          ...decodeContractDestroyedEvent(event),
          contractAddress: this.address,
        };
      },
      fromCount
    );
  }

  subscribeEvents(
    options: SubscribeOptions<ContractCreatedEvent | ContractDestroyedEvent>,
    fromCount?: number
  ): EventSubscription {
    const messageCallback = (event: node.ContractEvent): Promise<void> => {
      switch (event.eventIndex) {
        case -1: {
          return options.messageCallback({
            ...decodeContractCreatedEvent(event),
            contractAddress: this.address,
          });
        }

        case -2: {
          return options.messageCallback({
            ...decodeContractDestroyedEvent(event),
            contractAddress: this.address,
          });
        }

        default:
          throw new Error("Invalid event index: " + event.eventIndex);
      }
    };
    const errorCallback = (
      err: any,
      subscription: Subscription<node.ContractEvent>
    ): Promise<void> => {
      return options.errorCallback(
        err,
        subscription as unknown as Subscription<
          ContractCreatedEvent | ContractDestroyedEvent
        >
      );
    };
    const opt: SubscribeOptions<node.ContractEvent> = {
      pollingInterval: options.pollingInterval,
      messageCallback: messageCallback,
      errorCallback: errorCallback,
    };
    return subscribeToEvents(opt, this.address, fromCount);
  }
}
