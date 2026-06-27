[variables]
NODE_VERSION = "22"

[phases.setup]
nixPkgs = ["nodejs_22", "openssl"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npx prisma db push --accept-data-loss && npx prisma generate && npx next start -H 0.0.0.0 -p ${PORT:-3000}"
