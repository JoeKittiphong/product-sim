import { openDB } from 'idb'

const DB_NAME = 'product-sim-db'
const STORE_NAME = 'projects'
const PROJECT_KEY = 'autosave'
const DB_VERSION = 1

let dbPromise

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }

  return dbPromise
}

export async function loadProject() {
  const db = await getDb()
  return db.get(STORE_NAME, PROJECT_KEY)
}

export async function saveProject(project) {
  const db = await getDb()
  return db.put(STORE_NAME, project, PROJECT_KEY)
}
