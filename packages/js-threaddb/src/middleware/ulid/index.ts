import { ulid } from "ulid";
import { DBCore, DBCoreMutateRequest, DBCoreTable, Middleware } from "dexie";

export function createUlidMiddleware(core: DBCore): DBCore {
  return {
    ...core,
    table(tableName: string): DBCoreTable {
      const table = core.table(tableName);
      // Utility tables start with _
      // TODO: Is this too simplistic a rule?
      if (tableName.startsWith("_")) return table;
      return {
        ...table,
        async mutate(req: DBCoreMutateRequest) {
          switch (req.type) {
            case "add":
            case "put":
              const { primaryKey } = table.schema;
              // Assume "_id" should be a ulid if its autoIncrementing
              if (primaryKey.keyPath === "_id" && primaryKey.autoIncrement) {
                req.values.forEach(
                  (value) => (value._id = value._id || ulid())
                );
              }
              break;
          }
          const res = await table.mutate(req);
          return res;
        },
      };
    },
  };
}

export const ulidMiddleware: Middleware<DBCore> = {
  stack: "dbcore",
  name: "UlidMiddleware",
  create: createUlidMiddleware,
};
