/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/counter_hook.json`.
 */
export type CounterHook = {
  "address": "EiAAboUH3o19cRw4wRo2f2erCcbGtRUtq9PgNS4RGgi",
  "metadata": {
    "name": "counterHook",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Counter hook program for tracking token transfers"
  },
  "instructions": [
    {
      "name": "initializeMintTradeCounter",
      "discriminator": [
        22,
        209,
        170,
        141,
        84,
        237,
        5,
        252
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "docs": [
            "The mint to track"
          ]
        },
        {
          "name": "mintTradeCounter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  45,
                  116,
                  114,
                  97,
                  100,
                  101,
                  45,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "updateMintTradeCounter",
      "discriminator": [
        21,
        222,
        164,
        135,
        94,
        64,
        24,
        138
      ],
      "accounts": [
        {
          "name": "mint",
          "docs": [
            "The mint being transferred"
          ]
        },
        {
          "name": "mintTradeCounter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  45,
                  116,
                  114,
                  97,
                  100,
                  101,
                  45,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "sourceOwner",
          "type": "pubkey"
        },
        {
          "name": "destinationOwner",
          "type": "pubkey"
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Invalid transfer amount"
    },
    {
      "code": 6001,
      "name": "counterNotInitialized",
      "msg": "Counter not initialized"
    },
    {
      "code": 6002,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6003,
      "name": "invalidMint",
      "msg": "Invalid mint"
    }
  ]
};
