const mysql = require('mysql2');

class Database {

  constructor(dbSettings) {
    this.connection = mysql.createConnection(dbSettings);
  }

  execute(sql, input) {
    return new Promise(resolve => {
      this.connection.execute(sql, input, (err, results, fields) => {
        resolve(results);
      });
    });
  }
}


module.exports = { Database };
