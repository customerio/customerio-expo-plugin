const fs = require('fs');

try {
  const { runPostInstall } = require('customerio-reactnative/postinstall');

  console.log(runPostInstall)
  runPostInstall();
} catch (error) {
  console.log('err', error)
} // do nothing if this operation fails
