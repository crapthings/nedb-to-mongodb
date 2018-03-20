#!/usr/bin/env node

const { promisify } = require('util')

const program = require('commander')
const Nedb = require('nedb')
const { MongoClient } = require('mongodb')

const config = {}

// Parsing command-line options
program.version('0.1.1')
  .option('-h --mongodb-host [host]', 'Host where your MongoDB is (default: localhost)')
  .option('-p --mongodb-port [port]', 'Port on which your MongoDB server is running (default: 27017)', parseInt)
  .option('-d --mongodb-dbname [name]', 'Name of the Mongo database')
  .option('-c --mongodb-collection [name]', 'Collection to put your data into')
  .option('-n --nedb-datafile [path]', 'Path to the NeDB data file')
  .option('-k --keep-ids [true/false]', 'Whether to keep ids used by NeDB or have MongoDB generate ObjectIds (probably a good idea to use ObjectIds from now on!)')
  .option('-f --force-clean', 'Clean collection before insert')
  .parse(process.argv)

console.log('NEED SOME HELP? Type ./transfer.js --help')
console.log('-----------------------------------------')

// Making sure we have all the config parameters we need
if (!program.mongodbHost)
  console.log('No MongoDB host provided, using default (localhost)')

config.mongodbHost = program.mongodbHost || 'localhost'

if (!program.mongodbPort)
  console.log('No MongoDB port provided, using default (27017)')

config.mongodbPort = program.mongodbPort || 27017

if (!program.mongodbDbname) {
  console.log('No MongoDB database name provided, can\'t proceed.')
  process.exit(1)
}

config.mongodbDbname = program.mongodbDbname

if (!program.mongodbCollection) {
  console.log('No MongoDB collection name provided, can\'t proceed.')
  process.exit(1)
}

config.mongodbCollection = program.mongodbCollection

if (!program.nedbDatafile) {
  console.log('No NeDB datafile path provided, can\'t proceed')
  process.exit(1)
}

config.nedbDatafile = program.nedbDatafile

if (!program.keepIds || typeof program.keepIds !== 'string') {
  console.log('The --keep-ids option wasn\'t used or not explicitely initialized.')
  process.exit(1)
}

config.keepIds = program.keepIds === 'true' ? true : false
config.forceClean = program.forceClean ? true : false

transfer()

async function transfer() {
  try {
    const url = `mongodb://${config.mongodbHost}:${config.mongodbPort}`
    const client = await MongoClient.connect(url)
    console.log(`${url} connected`)
    const db = client.db(config.mongodbDbname)
    const collection = db.collection(config.mongodbCollection)

    const nedb = new Nedb(config.nedbDatafile)
    const loadDatabase = () => new Promise((resolve, reject) => nedb.loadDatabase(err => err ? reject([err, null]) : resolve([null, true])))

    if (config.forceClean)
      await collection.deleteMany({})

    await loadDatabase()

    const docs = nedb.getAllData()

    if (docs.length === 0) {
      console.log(`The NeDB database at ${config.nedbDatafile} contains no data, no work required`)
      console.log('You should probably check the NeDB datafile path though!')
      process.exit(0)
    } else {
      console.log(`Loaded data from the NeDB database at ${config.nedbDatafile}, ${docs.length} documents`)
    }

    if (!config.keepIds) docs.forEach(doc => delete doc._id)

    console.log('Inserting documents...')
    await collection.insertMany(docs)

    console.log('Everything went fine')
    process.exit(0)
  } catch(err) {
    console.log(err)
    process.exit(1)
  }
}
