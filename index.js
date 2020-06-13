const { Database } = require("./database");
const config = require("./config");

const liveDb = new Database(config.new);
const oldDb = new Database(config.old);

(async() => {
  let categories = await oldDb.execute("SELECT DISTINCT soortgerecht FROM menu", []);
  for (let i = 0; i < categories.length; i++) {
    let category = categories[i].soortgerecht;
    await liveDb.execute("INSERT INTO category (name) VALUES (?)", [category]);
  }

  let products = await oldDb.execute("SELECT * FROM soortgerecht");
  for (let i = 0; i < products.length; i++) {
    let product = products[i];
    let name = product.naam;
    let menuNumber = product.menunummer;
    let menuAddon = product.menu_toevoeging;
    let price = product.price;
    let categoryName = product.soortgerecht;
    let description = product.beschrijving;

    let onlyProductname = getProductName(name);
    if (await checkIfProductIsInDb(onlyProductname)) {
      // Product is already in the datbase
      // And only need to add the sub product
      let productId = await checkIfProductIsInDb(onlyProductname);
    }
    else {
      // Product is not added to the database
      let categoryId = await getIdOfCategory(categoryName);
      await liveDb.execute("INSERT INTO product (name, number, price, description, catgory_id) VALUES (?,?,?,?,?)", [
        onlyProductname,
        menuNumber + '' + menuAddon,
        price,
        description,
        categoryId,
      ]);

      let subProduct = getSubProduct(name);
      if (subProduct) {
        // There is a sub product
        
      }
    }
  }


})();

async function getIdOfCategory(category) {
  let result = await liveDb.execute("SELECT id FROM category WHERE name=?", category);
  return result[0].id;
}

function getProductName(productName) {
  let result = productName.split("met");
  result = result[0].trim();
  return result;
}

async function getProductId(productName) {
  let result = await liveDb.execute("SELECT id FROM product WHERE name = ?");
  return result[0].id;
}

function getSubProduct(productName) {
  let result = productName.split("met");
  if (result.length > 1) {
    result = result[1].trim();
    return result;
  }
  return false;
}

async function checkIfProductIsInDb(productName) {
  let name = productName.split("met");
  name = name[0].trim();

  let result = await liveDb.execute("SELECT id FROM product WHERE name = ?", [name]);
  if (result.length > 0) {
    return result[0].id;
  }
  return false;
}
