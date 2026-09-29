(ns external-sources.config
  (:require [clojure.string :as str]))

(def ^:private defaults {:poll-interval-ms 30000 :max-jobs 10 :request-timeout-ms 30000})

(defn- positive-long [s]
  (when s (try (let [n (Long/parseLong (str/trim s))] (when (pos? n) n)) (catch NumberFormatException _ nil))))

(defn- https-url? [s]
  (try (let [u (java.net.URI. s)]
         (and (= "https" (some-> (.getScheme u) str/lower-case)) (some? (.getHost u))))
       (catch java.net.URISyntaxException _ false)))

(defn load
  "Load worker configuration. HTTP is accepted only with the explicit test/dev flag."
  ([] (load (System/getenv)))
  ([env]
   (let [base (some-> (get env "EXTERNAL_SOURCES_CLOUD_BASE_URL") str/trim)
         token (some-> (get env "EXTERNAL_SOURCES_WORKER_TOKEN") str/trim)
         insecure? (= "true" (str/lower-case (str/trim (or (get env "EXTERNAL_SOURCES_ALLOW_INSECURE_HTTP") "false"))))
         errors (cond-> []
                  (and base (not (or (https-url? base) (and insecure? (.startsWith base "http://")))) )
                  (conj "cloud base URL must be an HTTPS URL")
                  (and (get env "EXTERNAL_SOURCES_POLL_INTERVAL_MS")
                       (nil? (positive-long (get env "EXTERNAL_SOURCES_POLL_INTERVAL_MS"))))
                  (conj "poll interval must be a positive integer")
                  (and (get env "EXTERNAL_SOURCES_MAX_JOBS")
                       (nil? (positive-long (get env "EXTERNAL_SOURCES_MAX_JOBS"))))
                  (conj "max jobs must be a positive integer")
                  (and (get env "EXTERNAL_SOURCES_REQUEST_TIMEOUT_MS")
                       (nil? (positive-long (get env "EXTERNAL_SOURCES_REQUEST_TIMEOUT_MS"))))
                  (conj "request timeout must be a positive integer"))
         missing (cond-> [] (str/blank? base) (conj :cloud-base-url) (str/blank? token) (conj :worker-token))]
     (if (or (seq missing) (seq errors))
       (throw (ex-info "Invalid external sources worker configuration" {:missing (set missing) :errors errors}))
       (merge defaults {:cloud-base-url (str/replace base #"/$" "")
                        :worker-token token
                        :allow-insecure-http? insecure?}
              (into {} (for [[k env-key] [[:poll-interval-ms "EXTERNAL_SOURCES_POLL_INTERVAL_MS"]
                                          [:max-jobs "EXTERNAL_SOURCES_MAX_JOBS"]
                                          [:request-timeout-ms "EXTERNAL_SOURCES_REQUEST_TIMEOUT_MS"]]
                         :when (get env env-key)]
                     [k (positive-long (get env env-key))]))))))))
