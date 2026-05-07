import { type Address, zeroAddress } from "viem";

import { ARBITRUM, ARBITRUM_SEPOLIA, AVALANCHE, AVALANCHE_FUJI, BOTANIX, ContractsChainId } from "./chains";

export const CONTRACTS = {
  [ARBITRUM]: {
    // V1
    Vault: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    VaultReader: "0xfebB9f4CAC4cD523598fE1C5771181440143F24A",
    GovToken: "0x2A29D3a792000750807cc401806d6fd539928481",
    NATIVE_TOKEN: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDG: "0x45096e7aA921f27590f8F19e457794EB09678141",



    PositionRouter: "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868",

    ReferralStorage: "0xe6fab3f0c7199b0d34d7fbe83394fc0e0d06e99d",
    Timelock: "0xaa50bD556CE0Fe61D4A57718BA43177a3aB6A597",

    // Synthetics
    DataStore: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
    EventEmitter: "0xC8ee91A54287DB53897056e12D9819156D3822Fb",
    SubaccountRouter: "0x5b9A353F18d543B9F8a57B2AE50a4FBc80033EC1",
    ExchangeRouter: "0x87d66368cD08a7Ca42252f5ab44B2fb6d1Fb8d15",
    DepositVault: "0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55",
    WithdrawalVault: "0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701C55",
    OrderVault: "0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5",
    ShiftVault: "0xfe99609C4AA83ff6816b64563Bdffd7fa68753Ab",
    SyntheticsReader: "0x65A6CC451BAfF7e7B4FDAb4157763aB4b6b44D0E",
    SyntheticsRouter: "0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6",

    GlvReader: "0xb51e34dc3A7c80E4ABbC3800aD0e487b7b878339",
    GlvRouter: "0x10Fa5Bd343373101654E896B43Ca38Fd8f3789F9",
    GlvVault: "0x393053B58f9678C9c28c2cE941fF6cac49C3F8f9",

    GelatoRelayRouter: "0x0C08518C41755C6907135266dCCf09d51aE53CC4",
    SubaccountGelatoRelayRouter: "0xA1D94802EcD642051B677dBF37c8E78ce6dd3784",

    MultichainClaimsRouter: "0x2A7244EE5373D2F161cE99F0D144c12860D651Af",
    MultichainGlvRouter: "0xFdaFa6fbd4B480017FD37205Cb3A24AE93823956",
    MultichainGmRouter: "0xF53e30CE07f148fdE6e531Be7dC0b6ad670E8C6e",
    MultichainOrderRouter: "0x3c796504d47013Ea0552CCa57373B59DF03D34a0",
    MultichainSubaccountRouter: "0x99CD306B777C5aAb842bA65e4f7FF0554ECDe808",
    MultichainTransferRouter: "0xC1D1354A948bf717d6d873e5c0bE614359AF954D",
    MultichainVault: "0xCeaadFAf6A8C489B250e407987877c5fDfcDBE6E",
    LayerZeroProvider: "0x7129Ea01F0826c705d6F7ab01Cf3C06bb83E9397",

    ChainlinkPriceFeedProvider: "0x38B8dB61b724b51e42A88Cb8eC564CD685a0f53B",
    ClaimHandler: "0x28f1F4AA95F49FAB62464536A269437B13d48976",

    // External
    ExternalHandler: "0x389CEf541397e872dC04421f166B5Bc2E0b374a5",
    OpenOceanRouter: "0x6352a56caadC4F1E25CD6c75970Fa768A3304e64",
    Multicall: "0xe79118d6D92a4b23369ba356C90b9A7ABf1CB961",
    ArbitrumNodeInterface: "0x00000000000000000000000000000000000000C8",
    LayerZeroEndpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    GelatoRelayAddress: "0xaBcC9b596420A9E9172FD5938620E265a0f9Df92",
  },
  [AVALANCHE]: {
    // V1
    Vault: "0x9ab2De34A33fB459b538c43f251eB825645e8595",
    VaultReader: "0x66eC8fc33A26feAEAe156afA3Cb46923651F6f0D",
    GovToken: "0x0ff183E29f1924ad10475506D7722169010CecCb",
    NATIVE_TOKEN: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    USDG: "0xc0253c3cC6aa5Ab407b5795a04c28fB063273894",




    PositionRouter: "0xffF6D276Bc37c61A23f06410Dce4A400f66420f8",

    ReferralStorage: "0x827ed045002ecdabeb6e2b0d1604cf5fc3d322f8",
    Timelock: "0x8A68a039D555599Fd745f9343e8dE20C9eaFca75",

    // Synthetics
    DataStore: "0x2F0b22339414ADeD7D5F06f9D604c7fF5b2fe3f6",
    EventEmitter: "0xDb17B211c34240B014ab6d61d4A31FA0C0e20c26",
    SubaccountRouter: "0x88a5c6D94634Abd7745f5348e5D8C42868ed4AC3",
    ExchangeRouter: "0xF0864BE1C39C0AB28a8f1918BC8321beF8F7C317",
    DepositVault: "0x90c670825d0C62ede1c5ee9571d6d9a17A722DFF",
    WithdrawalVault: "0xf5F30B10141E1F63FC11eD772931A8294a591996",
    OrderVault: "0xD3D60D22d415aD43b7e64b510D86A30f19B1B12C",
    ShiftVault: "0x7fC46CCb386e9bbBFB49A2639002734C3Ec52b39",
    SyntheticsReader: "0x1EC018d2b6ACCA20a0bEDb86450b7E27D1D8355B",
    SyntheticsRouter: "0x820F5FfC5b525cD4d88Cd91aCf2c28F16530Cc68",

    GlvReader: "0x12Ac77003B3D11b0853d1FD12E5AF22a9060eC4b",
    GlvRouter: "0x4729D9f61c0159F5e02D2C2e5937B3225e55442C",
    GlvVault: "0x527FB0bCfF63C47761039bB386cFE181A92a4701",

    GelatoRelayRouter: "0xa61f92ab63cc5C3d60574d40A6e73861c37aaC95",
    SubaccountGelatoRelayRouter: "0x58b09FD12863218F2ca156808C2Ae48aaCD0c072",

    MultichainClaimsRouter: "0x9080f8A35Da53F4200a68533FB1dC1cA05357bDB",
    MultichainGlvRouter: "0x2A7244EE5373D2F161cE99F0D144c12860D651Af",
    MultichainGmRouter: "0x10Fa5Bd343373101654E896B43Ca38Fd8f3789F9",
    MultichainOrderRouter: "0x99CD306B777C5aAb842bA65e4f7FF0554ECDe808",
    MultichainSubaccountRouter: "0xB36a4c6cDeDea3f31b3d16F33553F93b96b178F4",
    MultichainTransferRouter: "0x8c6e20A2211D1b70cD7c0789EcE44fDB19567621",
    MultichainVault: "0x6D5F3c723002847B009D07Fe8e17d6958F153E4e",
    LayerZeroProvider: "0xA1D94802EcD642051B677dBF37c8E78ce6dd3784",

    ChainlinkPriceFeedProvider: "0x05d97cee050bfb81FB3EaD4A9368584F8e72C88e",
    ClaimHandler: "0x7FfedCAC2eCb2C29dDc027B60D6F8107295Ff2eA",

    // External
    ExternalHandler: "0xD149573a098223a9185433290a5A5CDbFa54a8A9",
    OpenOceanRouter: "0x6352a56caadC4F1E25CD6c75970Fa768A3304e64",
    Multicall: "0x50474CAe810B316c294111807F94F9f48527e7F8",
    ArbitrumNodeInterface: zeroAddress,
    LayerZeroEndpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    GelatoRelayAddress: "0xaBcC9b596420A9E9172FD5938620E265a0f9Df92",
  },
  [BOTANIX]: {
    // Synthetics
    DataStore: "0xA23B81a89Ab9D7D89fF8fc1b5d8508fB75Cc094d",
    EventEmitter: "0xAf2E131d483cedE068e21a9228aD91E623a989C2",
    SubaccountRouter: "0x11E590f6092D557bF71BaDEd50D81521674F8275",
    ExchangeRouter: "0x72fa3978E2E330C7B2debc23CB676A3ae63333F6",
    DepositVault: "0x4D12C3D3e750e051e87a2F3f7750fBd94767742c",
    WithdrawalVault: "0x46BAeAEdbF90Ce46310173A04942e2B3B781Bf0e",
    OrderVault: "0xe52B3700D17B45dE9de7205DEe4685B4B9EC612D",
    ShiftVault: "0xa7EE2737249e0099906cB079BCEe85f0bbd837d4",

    SyntheticsReader: "0xa254B60cbB85a92F6151B10E1233639F601f2F0F",
    SyntheticsRouter: "0x3d472afcd66F954Fe4909EEcDd5c940e9a99290c",

    GlvReader: "0x490d660A21fB75701b7781E191cB888D1FE38315",
    GlvRouter: "0x348Eca94e7c6F35430aF1cAccE27C29E9Bef9ae3",
    GlvVault: "0xd336087512BeF8Df32AF605b492f452Fd6436CD8",

    GelatoRelayRouter: "0x7f8eF83C92B48a4B5B954A24D98a6cD0Ed4D160a",
    SubaccountGelatoRelayRouter: "0xfbb9C41046E27405224a911f44602C3667f9D8f6",

    MultichainClaimsRouter: "0x790Ee987b9B253374d700b07F16347a7d4C4ff2e",
    MultichainGlvRouter: "0xEE027373517a6D96Fe62f70E9A0A395cB5a39Eee",
    MultichainGmRouter: "0x4ef8394CD5DD7E3EE6D30824689eF461783a3360",
    MultichainOrderRouter: "0x5c5DBbcDf420B5d81d4FfDBa5b26Eb24E6E60d52",
    MultichainSubaccountRouter: "0xd3B6E962f135634C43415d57A28E688Fb4f15A58",
    MultichainTransferRouter: "0x901f26a57edCe65Ef3FBcCD260433De9B2279852",
    MultichainVault: "0x9a535f9343434D96c4a39fF1d90cC685A4F6Fb20",
    LayerZeroProvider: "0x61af99b07995cb7Ee8c2FACF6D8fb6042FeAA0d9",

    ChainlinkPriceFeedProvider: "0xDc613305e9267f0770072dEaB8c03162e0554b2d",
    ClaimHandler: "0x3ca0f3ad78a9d0b2a0c060fe86d1141118a285c4",

    // External
    ExternalHandler: "0x36b906eA6AE7c74aeEE8cDE66D01B3f1f8843872",
    OpenOceanRouter: zeroAddress,
    Multicall: "0x4BaA24f93a657f0c1b4A0Ffc72B91011E35cA46b",
    LayerZeroEndpoint: "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B",
    ArbitrumNodeInterface: zeroAddress,
    GelatoRelayAddress: "0x61aCe8fBA7B80AEf8ED67f37CB60bE00180872aD",

    Vault: zeroAddress,
    PositionRouter: zeroAddress,
    ReferralStorage: zeroAddress,
    VaultReader: zeroAddress,
    USDG: zeroAddress,
    Router: zeroAddress,
    GovToken: zeroAddress,
    OrderBook: zeroAddress,


    // botanix specific
    NATIVE_TOKEN: "0x0D2437F93Fed6EA64Ef01cCde385FB1263910C56",
    StBTC: "0xF4586028FFdA7Eca636864F80f8a3f2589E33795",
    PBTC: "0x0D2437F93Fed6EA64Ef01cCde385FB1263910C56",
  },

  [AVALANCHE_FUJI]: {
    // V1
    Vault: zeroAddress,
    Router: zeroAddress,
    VaultReader: zeroAddress,
    NATIVE_TOKEN: "0x1D308089a2D1Ced3f1Ce36B1FcaF815b07217be3",
    USDG: zeroAddress,




    PositionRouter: zeroAddress,

    ReferralStorage: "0x192e82A18a4ab446dD9968f055431b60640B155D",

    // Synthetics
    DataStore: "0xEA1BFb4Ea9A412dCCd63454AbC127431eBB0F0d4",
    EventEmitter: "0xc67D98AC5803aFD776958622CeEE332A0B2CabB9",
    ExchangeRouter: "0x0a458C96Ac0B2a130DA4BdF1aAdD4cb7Be036d11",
    SubaccountRouter: "0xD5EE3ECAF5754CE5Ff74847d0caf094EBB12ed5e",
    DepositVault: "0x2964d242233036C8BDC1ADC795bB4DeA6fb929f2",
    WithdrawalVault: "0x74d49B6A630Bf519bDb6E4efc4354C420418A6A2",
    OrderVault: "0x25D23e8E655727F2687CC808BB9589525A6F599B",
    ShiftVault: "0x257D0EA0B040E2Cd1D456fB4C66d7814102aD346",
    SyntheticsReader: "0xf82Cc6EB57F8FF86bc5c5e90B8BA83DbBFB517eE",
    SyntheticsRouter: "0x5e7d61e4C52123ADF651961e4833aCc349b61491",
    Timelock: zeroAddress,

    GlvReader: "0xdeaC9ea3c72C102f2a9654b8E1A14Ef86Cdd3146",
    GlvRouter: "0x6B6595389A0196F882C0f66CB1F401f1D24afEdC",
    GlvVault: "0x76f93b5240DF811a3fc32bEDd58daA5784e46C96",

    GelatoRelayRouter: "0xC2917611f422b1624D7316375690B532c149F54b",
    SubaccountGelatoRelayRouter: "0x9022ADce7c964852475aB0de801932BaDEB0C765",

    MultichainClaimsRouter: "0xa080c3E026467E1fa6E76D29A057Bf1261a4ec86",
    MultichainGlvRouter: "0x5060A75868ca21A54C650a70E96fa92405831b15",
    MultichainGmRouter: "0xe32632F65198eF3080ccDe22A6d23819203dBc42",
    MultichainOrderRouter: "0x6169DD9Bc75B1d4B7138109Abe58f5645BA6B8fE",
    MultichainSubaccountRouter: "0xa51181CC37D23d3a4b4B263D2B54e1F34B834432",
    MultichainTransferRouter: "0x0bD6966B894D9704Ce540babcd425C93d2BD549C",
    MultichainVault: "0xFd86A5d9D6dF6f0cB6B0e6A18Bea7CB07Ada4F79",
    LayerZeroProvider: "0xdaa9194bFD143Af71A8d2cFc8F2c0643094a77C5",

    ChainlinkPriceFeedProvider: "0x2e149AbC99cDC98FB0207d6F184DC323CEBB955B",
    ClaimHandler: "0x01D68cf13B8f67b041b8D565931e1370774cCeBd",

    // External
    OpenOceanRouter: zeroAddress,
    ExternalHandler: "0x0d9F90c66C392c4d0e70EE0d399c43729B942512",
    Multicall: "0x966D1F5c54a714C6443205F0Ec49eEF81F10fdfD",
    ArbitrumNodeInterface: zeroAddress,
    LayerZeroEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  },

  [ARBITRUM_SEPOLIA]: {
    // Synthetics - test deployment addresses (from README.md)
    DataStore: "0x150c5f1D3fD3fb80F454BfCd7ff4cdbC16752894",
    EventEmitter: "0xE5900087c931Df541167Ae913656Ab180fc0a69d",
    ExchangeRouter: "0xC90DB50cC98DB44f745AF1B24e47aB644d14adb1",
    SubaccountRouter: "0x8427e498190d41ae8D28cFC8C64E31678533386A",
    DepositVault: "0x7b68bF1e82Fa73c60356C0Ae96b93F1F55103126",
    WithdrawalVault: "0xFD3Ec58EC7a4aC35Ff6eC821B2A3Ce0818dE76Ba",
    OrderVault: "0x0d902348A1FA2F690fB59a9b9785518Ba71eb85e",
    ShiftVault: "0x1e1ce89123F0c3FB7dBA1A9949FfdabF93d039D9",
    SyntheticsReader: "0x5774Bf33A3293bF7A9cB9AEd3035404c3f1e6686",
    SyntheticsRouter: "0xdf063122B0c8f99316ef28Cc7EE4509Ab9B6A6f6",

    GlvReader: "0x95a1a019Ec114A006e3D04f95D044C44E848Bdf7",
    GlvRouter: "0xa76cCe19aE0341D49d2dBb2D8bdE75eE107c17f4",
    GlvVault: "0x9df4C6C0844A34344c3148Ab4835821A51Ca81cC",

    GelatoRelayRouter: "0x30230E6fd7120ba27E272e4D444C681a2221a21c",
    SubaccountGelatoRelayRouter: "0xD5856228563d1F22A78f45aF03245F9E1C75C19a",

    MultichainClaimsRouter: zeroAddress,
    MultichainGlvRouter: "0xd23BB11B0821cd0aDD0b76820899Fa65ed0dFEF0",
    MultichainGmRouter: "0xFc210D6F6A44e7cBb0c4a3371765f02e2437E78B",
    MultichainOrderRouter: "0x76F6cb81179EeDE92b69F6c9Ee729F3471f72b69",
    MultichainSubaccountRouter: zeroAddress,
    MultichainTransferRouter: "0x15b0d7db6137F6cAaB4c4E8CA8318Cb46e46C19B",
    MultichainVault: "0xC367051b111d4b854bFd176c1440edF1361E23E8",
    LayerZeroProvider: "0xCaDa136eb3503eE2b2DB01757750d12212b657D1",

    ChainlinkPriceFeedProvider: "0x161D0F1eE4b8F4B94130572ECa509574ad7c1EC9",
    ReferralStorage: "0x8Af45aB19EcDC51a63775f52b03f5160f2CdA5E8",
    ClaimHandler: "0xDEE5c9530Da5695aa16Cd228118149ab9a4C41eb",

    // External
    ExternalHandler: "0x92F26bCf3C28eBBFA45e20258c54b398573a1cF8",
    Multicall: "0xc08187dfDa2399141E30c187781a0E631E24315B",
    NATIVE_TOKEN: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
    LayerZeroEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    ArbitrumNodeInterface: "0x00000000000000000000000000000000000000C8",
    GelatoRelayAddress: "0xaBcC9b596420A9E9172FD5938620E265a0f9Df92",

    USDG: zeroAddress,
    OpenOceanRouter: zeroAddress,
    Vault: zeroAddress,
    PositionRouter: zeroAddress,
    Router: zeroAddress,
    VaultReader: zeroAddress,
    Timelock: zeroAddress,
  },
};

type ExtractContractNames<T extends object> = {
  [K in keyof T]: keyof T[K];
}[keyof T];

export type ContractName = ExtractContractNames<typeof CONTRACTS>;

export function getContract(chainId: ContractsChainId, name: ContractName): Address {
  if (!CONTRACTS[chainId]) {
    throw new Error(`Unknown chainId ${chainId}`);
  }

  if (!CONTRACTS[chainId][name]) {
    throw new Error(`Unknown contract "${name}" for chainId ${chainId}`);
  }

  return CONTRACTS[chainId][name];
}
