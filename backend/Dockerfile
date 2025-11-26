FROM heroiclabs/nakama:3.26.0
COPY nakama-config.yml /nakama/config/nakama.yml
COPY build/index.js /nakama/data/modules/build/index.js
ENV NAKAMA_RUNTIME_JS_ENTRYPOINT=/nakama/data/modules/build/index.js
CMD /nakama/nakama migrate up --database.address ${DATABASE_URL} && exec /nakama/nakama --name nakama1 --config /nakama/config/nakama.yml --database.address ${DATABASE_URL} --logger.level INFO --http.port ${PORT}