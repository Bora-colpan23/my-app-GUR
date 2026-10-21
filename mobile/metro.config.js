// Metro, proje kökünün DIŞINDAKİ dosyaları varsayılan olarak izlemez.
// GUR'un saf ortak modülleri (shared/deck.js, src/data/restaurants.js)
// depo kökünde duruyor ve mobil uygulama onları İKİNCİ BİR KOPYA
// ÇIKARMADAN kullanıyor — "shared/ tek doğruluk kaynağı" kuralı mobilde
// de geçerli.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const proje = __dirname;
const depoKoku = path.resolve(proje, '..');

const config = getDefaultConfig(proje);
config.watchFolders = [depoKoku];

// Paketler YALNIZCA mobile/node_modules'ten çözülsün. Hiyerarşik arama
// açık kalsaydı metro depo kökündeki WEB bağımlılıklarına (react-router,
// motion, farklı bir react) de ulaşır ve iki react kopyası yüklenirdi.
config.resolver.nodeModulesPaths = [path.resolve(proje, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
