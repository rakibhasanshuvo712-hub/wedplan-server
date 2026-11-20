// Delegate to root index.js where all API tasks are centralized
const mainIndex = require('../index');

if (require.main === module) {
  mainIndex.startServer();
}

module.exports = mainIndex;
