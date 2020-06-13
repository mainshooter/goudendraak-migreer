const { Database } = require("./database");
const config = require("./config");
const striptags = require("striptags");

const Entities = require('html-entities').XmlEntities;

const entities = new Entities();
const liveDb = new Database(config.new);
const oldDb = new Database(config.old);

(async() => {
  let categories = await oldDb.execute("SELECT DISTINCT soortgerecht FROM menu", []);
  for (let i = 0; i < categories.length; i++) {
    let category = categories[i].soortgerecht;
    await liveDb.execute("INSERT INTO category (name) VALUES (?)", [category]);
  }

  let products = await oldDb.execute("SELECT * FROM menu", []);
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
      await addSubproduct(product, onlyProductname);
    }
    else {
      // Product is not added to the database
      let productNumber = i + 1;
      if (menuNumber) {
        productNumber = menuNumber + '' + menuAddon ? menuAddon : "";
      }
      let categoryId = await getIdOfCategory(categoryName);
      let input = [
        onlyProductname,
        productNumber,
        price,
        description,
        categoryId,
      ];
      let result = await liveDb.execute("INSERT INTO product (name, number, price, description, category_id) VALUES (?,?,?,?,?)", input);

      let subProduct = getSubProductName(name);
      if (subProduct) {
        // There is a sub product
        await addSubproduct(product, onlyProductname);
      }
    }
  }

  let sales = await oldDb.execute("SELECT DISTINCT saleDate FROM sales", []);
  for (let i = 0; i < sales.length; i++) {
    let sale = sales[i];

    let invoice = await liveDb.execute("INSERT INTO invoice (vat, created_at, updated_at) VALUES (?,?,?)", [9, sale.saleDate, sale.saleDate]);
    let invoiceId = invoice.insertId;

    let saleProducts = await oldDb.execute("SELECT itemId, amount FROM sales WHERE saleDate=?", [sale.saleDate]);
    for (let i = 0; i < saleProducts.length; i++) {
      let productSale = saleProducts[i];

      let product = await oldDb.execute("SELECT * FROM menu WHERE id=?", [productSale.itemId]);
      product = product[0];
      let productName = getProductName(product.naam);
      let subProductName = getSubProductName(product.naam);

      let productId = await getProductId(productName);
      let newProduct = await getProduct(productId);

      let input = [
        newProduct.name,
        newProduct.price,
        productSale.amount,
        invoiceId,
        newProduct.category_id,
        sale.saleDate,
        sale.saleDate,
        newProduct.id
      ];

      let invoiceProduct = await liveDb.execute("INSERT INTO invoice_product (name, price, amount, invoice_id, category_id, created_at, updated_at, product_id) VALUES (?,?,?,?,?,?,?,?)", input);

      if (subProductName) {
        let invoiceProductId = invoiceProduct.insertId;
        let subProductDb = await liveDb.execute("SELECT * FROM subproduct JOIN product_sub_product ON product_id=? AND sub_product_id=subproduct.id WHERE name = ?", [productId, subProductName]);
        subProductDb = subProductDb[0];
        await liveDb.execute("INSERT INTO invoice_subproduct (name, price, invoice_product_id, subproduct_id) VALUES (?,?,?,?)"[subProductDb.name, subProductDb.price, invoiceProductId, subProductDb.id]);
      }

    }
  }


})();

async function addSubproduct(fullProduct, name) {
  let fullProductName = fullProduct.naam;
  let subproductName = getSubProductName(fullProductName);
  let productId = await getProductId(name);
  let addProduct = await getProduct(productId);

  return new Promise(resolve => {

    let productPrice = parseFloat(fullProduct.price) - parseFloat(addProduct.price);

    liveDb.execute("INSERT INTO subproduct (name, price) VALUES (?, ?)", [
      subproductName,
      productPrice
    ]).then(result => {
      let subProductId = result.insertId;
      liveDb.execute("INSERT INTO product_sub_product (product_id, sub_product_id) VALUES (?,?)", [
        productId,
        subProductId,
      ]).then(result => {
        resolve(result);
      });
    });
  });
}

async function getIdOfCategory(category) {
  let result = await liveDb.execute("SELECT id FROM category WHERE name= ?", [category]);
  return result[0].id;
}

function getProductName(productName) {
  let result = productName.split("met");
  result = result[0].trim();
  return entities.decode(striptags(result));
}

async function getProductId(productName) {
  let result = await liveDb.execute("SELECT id FROM product WHERE name = ?", [productName]);
  return result[0].id;
}

async function getProduct(id) {
  let result = await liveDb.execute("SELECT * FROM product WHERE id = ?", [id]);
  if (result.length > 0) {
    return result[0];
  }
  return false;
}

function getSubProductName(productName) {
  let result = productName.split("met");
  if (result.length > 1) {
    result = result[1].trim();
    if (result == "0") {
      return false;
    }
    return entities.decode(striptags(result));
  }
  return false;
}

async function checkIfProductIsInDb(productName) {
  let name = productName.split("met");
  name = name[0].trim();

  let result = await liveDb.execute("SELECT id FROM product WHERE name = ?", [name]);
  if (result.length > 0) {
    return true;
  }
  return false;
}
