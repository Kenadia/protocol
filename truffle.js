require("babel-register");
require('babel-polyfill');

let mocha = {
  useColors: true
};

if (process.env.TRUFFLE_REPORTER) {
  mocha = {
    reporter: 'mocha-junit-reporter',
    reporterOptions: {
      mochaFile: './junit/test-results.xml'
    }
  };
}

module.exports = {
  networks: {
    kovan: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "42",
      gasPrice: 1000000000, // 1 gwei
      gas: 7900000
    },
    dev: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gasPrice: 1000000000, // 1 gwei
      gas: 7900000
    },
    coverage: {
      host: 'localhost',
      network_id: '*',
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01,
    },
    docker: {
      host: 'localhost',
      network_id: '1212',
      port: 8545
    }
  },
  mocha,
  solc: {
    optimizer: {
      enabled: true,
      runs: 10000
    }
  }
};
