Local docker running database and adminer
docker ps

Adminer to view database content
http://localhost:8080

To stop container safely
docker stop plant-tracker-adminer
docker stop plant-tracker-postgres

And start again
docker start plant-tracker-postgres
docker start plant-tracker-adminer
