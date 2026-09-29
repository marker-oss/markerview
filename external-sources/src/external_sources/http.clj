(ns external-sources.http
  (:require [clojure.data.json :as json])
  (:import [java.net URI]
           [java.net.http HttpClient HttpRequest HttpRequest$BodyPublishers HttpResponse$BodyHandlers]
           [java.time Duration]))

(defn client [] (HttpClient/newHttpClient))

(defn request-json
  "Send an HTTP request and decode its JSON response. Throws on non-2xx responses."
  [^HttpClient client {:keys [method url headers body timeout-ms]
                       :or {method :get headers {} timeout-ms 30000}}]
  (let [builder (doto (HttpRequest/newBuilder (URI/create url))
                  (.timeout (Duration/ofMillis timeout-ms))
                  (.header "Accept" "application/json"))
        _ (doseq [[name value] headers]
            (.header builder (if (keyword? name) (clojure.core/name name) (str name)) (str value)))
        payload (when (some? body) (json/write-str body))
        _ (if payload
            (doto builder
              (.header "Content-Type" "application/json")
              (.method (.toUpperCase (name method)) (HttpRequest$BodyPublishers/ofString payload)))
            (.method builder (.toUpperCase (name method)) (HttpRequest$BodyPublishers/noBody)))
        response (.send client (.build builder) (HttpResponse$BodyHandlers/ofString))
        status (.statusCode response)
        text (.body response)]
    (when-not (<= 200 status 299)
      (throw (ex-info (str "HTTP " status " from " url) {:status status :url url :body text})))
    (when-not (empty? text)
      (json/read-str text :key-fn keyword))))
