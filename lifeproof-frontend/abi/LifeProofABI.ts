export const LifeProofABI = {
  abi: [
    {
      "inputs": [
        { "internalType": "string", "name": "title", "type": "string" },
        { "internalType": "string", "name": "description", "type": "string" },
        { "internalType": "string", "name": "imageURI", "type": "string" },
        { "internalType": "string", "name": "category", "type": "string" },
        { "internalType": "bool", "name": "isPublic", "type": "bool" },
        { "internalType": "externalEuint8", "name": "moodExternal", "type": "bytes32" },
        { "internalType": "bytes", "name": "proof", "type": "bytes" }
      ],
      "name": "mintLifeEvent",
      "outputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "bool", "name": "isPublic", "type": "bool" } ],
      "name": "toggleVisibility",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getMyEvents",
      "outputs": [
        {
          "components": [
            { "internalType": "string", "name": "title", "type": "string" },
            { "internalType": "string", "name": "description", "type": "string" },
            { "internalType": "string", "name": "imageURI", "type": "string" },
            { "internalType": "string", "name": "category", "type": "string" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
            { "internalType": "bool", "name": "isPublic", "type": "bool" }
          ],
          "internalType": "struct LifeProof.LifeEvent[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getMyEventIds",
      "outputs": [ { "internalType": "uint256[]", "name": "", "type": "uint256[]" } ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ],
      "name": "getMoodHandle",
      "outputs": [ { "internalType": "euint8", "name": "", "type": "bytes32" } ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ],
      "name": "getEvent",
      "outputs": [
        {
          "components": [
            { "internalType": "string", "name": "title", "type": "string" },
            { "internalType": "string", "name": "description", "type": "string" },
            { "internalType": "string", "name": "imageURI", "type": "string" },
            { "internalType": "string", "name": "category", "type": "string" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
            { "internalType": "bool", "name": "isPublic", "type": "bool" }
          ],
          "internalType": "struct LifeProof.LifeEvent",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "offset", "type": "uint256" }, { "internalType": "uint256", "name": "limit", "type": "uint256" } ],
      "name": "getPublicFeed",
      "outputs": [ { "internalType": "uint256[]", "name": "", "type": "uint256[]" } ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "bool", "name": "doLike", "type": "bool" } ],
      "name": "like",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "address", "name": "user", "type": "address" } ],
      "name": "hasLiked",
      "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
      "name": "likeCounts",
      "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "string", "name": "cid", "type": "string" } ],
      "name": "addComment",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "uint256", "name": "offset", "type": "uint256" }, { "internalType": "uint256", "name": "limit", "type": "uint256" } ],
      "name": "getComments",
      "outputs": [
        {
          "components": [
            { "internalType": "address", "name": "user", "type": "address" },
            { "internalType": "string", "name": "cid", "type": "string" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
          ],
          "internalType": "struct LifeProof.CommentInfo[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
};


