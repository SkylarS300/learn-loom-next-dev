## Local Prisma Migrations with PlanetScale
Prisma requires a shadow database. Run a local MySQL container:
  docker run --name learnloom-shadow -e MYSQL_ROOT_PASSWORD=shadowpw -p 3307:3306 -d mysql:8
  docker exec -it learnloom-shadow mysql -uroot -pshadowpw -e "CREATE DATABASE IF NOT EXISTS prisma_shadow;"
Then add SHADOW_DATABASE_URL to .env
