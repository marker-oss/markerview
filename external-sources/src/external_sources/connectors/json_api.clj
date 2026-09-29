(ns external-sources.connectors.json-api
  (:require [clojure.string :as str]
            [external-sources.http :as http])
  (:import [java.net URI URLEncoder]
           [java.nio.charset StandardCharsets]
           [java.time OffsetDateTime]
           [java.time.format DateTimeParseException]))

(defn- encode [x] (URLEncoder/encode (str x) StandardCharsets/UTF_8))

(defn- add-query [url name value]
  (str url (if (.contains url "?") "&" "?") (encode name) "=" (encode value)))

(defn- present [record & keys]
  (some #(let [v (get record %)] (when (some? v) v)) keys))

(defn- rfc3339 [value field]
  (try
    (OffsetDateTime/parse (str value))
    (str value)
    (catch DateTimeParseException _
      (throw (ex-info (str field " must be RFC3339") {field value})))))

(defn- map-record [job record]
  (let [id (present record :marketplace_review_id :provider_record_id :id)
        created-at (present record :created_at :createdAt)]
    (when (or (str/blank? (str id)) (str/blank? (str created-at)))
      (throw (ex-info "JSON API record requires id and created_at" {:record record})))
    (cond-> {:provider_record_id (str (or (:provider_record_id record) (:id record) id))
             :external_product_id (str (or (present record :external_product_id :product_id)
                                           (:external_product_id job) ""))
             :seller_article (str (or (present record :seller_article :article)
                                      (:seller_article job) ""))
             :author_name (str (or (present record :author_name :author) ""))
             :rating (present record :rating)
             :title (str (or (:title record) ""))
             :text (str (or (present record :text :body) ""))
             :pros (str (or (:pros record) ""))
             :cons (str (or (:cons record) ""))
             :created_at (rfc3339 created-at :created_at)
             :url (str (or (:url record) ""))}
      (:marketplace_review_id record)
      (assoc :marketplace_review_id (str (:marketplace_review_id record)))
      (present record :updated_at :updatedAt)
      (assoc :updated_at (rfc3339 (present record :updated_at :updatedAt) :updated_at)))))

(defn- valid-url? [url allow-insecure-http?]
  (try (let [uri (URI. url)
             scheme (.getScheme uri)]
         (and (some? (.getHost uri))
              (or (= "https" scheme) (and allow-insecure-http? (= "http" scheme)))))
       (catch java.net.URISyntaxException _ false)))

(defn execute
  "Fetch a JSON API page and map its records to worker transport records.

   The endpoint must return {\"cursor\":\"...\",\"records\":[...]}. The job's
   cursor is sent as the `cursor` query parameter (config.cursor_param may rename
   it). Headers may be supplied by trusted cloud configuration in config.headers."
  [client job {:keys [request-timeout-ms allow-insecure-http?]}]
  (let [url (:url job)
        config (:config job)
        cursor (:cursor job)
        cursor-param (or (:cursor_param config) "cursor")
        request-url (if (str/blank? (str cursor)) url (add-query url cursor-param cursor))]
    (when-not (valid-url? url allow-insecure-http?)
      (throw (ex-info "JSON API URL must use HTTPS" {:url url})))
    (let [response (http/request-json client {:url request-url
                                              :headers (or (:headers config) {})
                                              :timeout-ms request-timeout-ms})
          records (:records response)]
      (when-not (sequential? records)
        (throw (ex-info "JSON API response must contain a records array" {})))
      {:cursor (str (or (:cursor response) cursor ""))
       :records (mapv #(map-record job %) records)})))
