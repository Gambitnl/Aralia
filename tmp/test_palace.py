import chromadb

c = chromadb.PersistentClient(path="C:/Users/Gambit/.mempalace/palace")
col = c.get_collection("mempalace_drawers")
total = col.count()
print(f"Total drawers in palace: {total:,}")

r = col.query(query_texts=["spell system architecture"], n_results=5, include=["metadatas"])
print("\nTop 5 results for 'spell system architecture':")
for m in r["metadatas"][0]:
    fname = m["source_file"].replace("\\", "/").split("/")[-1]
    room = m.get("room", "?")
    agent = m.get("added_by", "?")
    print(f"  - {fname} (room: {room}, agent: {agent})")
