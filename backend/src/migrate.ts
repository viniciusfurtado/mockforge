import { getDb } from './db/database';

async function run() {
  const db = await getDb();
  
  try {
    await db.run("ALTER TABLE endpoints ADD COLUMN workspaceId TEXT");
    console.log("Column workspaceId added");
    
    // Assign all to default workspace
    const defaultWs = await db.get("SELECT id FROM workspaces ORDER BY createdAt ASC LIMIT 1");
    if (defaultWs) {
      await db.run("UPDATE endpoints SET workspaceId = ?", [defaultWs.id]);
      console.log("Updated endpoints with default workspace");
    }
  } catch(e: any) {
    console.log(e.message);
  }
}
run();
