(ns external-sources.worker-integration-test
  (:require [clojure.data.json :as json]
            [clojure.test :refer [deftest is]]
            [external-sources.http :as http]
            [external-sources.worker :as worker])
  (:import [com.sun.net.httpserver HttpExchange HttpHandler HttpServer]
           [java.net InetSocketAddress]
           [java.nio.charset StandardCharsets]))

(defn- body [^HttpExchange exchange]
  (slurp (.getRequestBody exchange) :encoding "UTF-8"))

(defn- respond! [^HttpExchange exchange status value]
  (let [bytes (.getBytes (json/write-str value) StandardCharsets/UTF_8)]
    (.add (.getResponseHeaders exchange) "Content-Type" "application/json")
    (.sendResponseHeaders exchange status (count bytes))
    (with-open [out (.getResponseBody exchange)] (.write out bytes))))

(defn- server [handler]
  (doto (HttpServer/create (InetSocketAddress. "127.0.0.1" 0) 0)
    (.createContext "/" (reify HttpHandler (handle [_ exchange] (handler exchange))))
    (.start)))

(deftest polls-claims-fetches-and-reports-versioned-result
  (let [seen (atom [])
        provider (server
                  (fn [exchange]
                    (swap! seen conj {:path (.getPath (.getRequestURI exchange))
                                      :query (.getQuery (.getRequestURI exchange))
                                      :method (.getRequestMethod exchange)})
                    (respond! exchange 200 {:cursor "next"
                                            :records [{:id "r-1" :author "Ada" :rating 5
                                                       :body "Useful" :created_at "2026-09-29T10:00:00Z"}]})))
        provider-url (str "http://127.0.0.1:" (.getPort (.getAddress provider)) "/reviews")
        api (server
             (fn [exchange]
               (let [path (.getPath (.getRequestURI exchange))
                     method (.getRequestMethod exchange)]
                 (swap! seen conj {:path path :method method
                                   :auth (.getFirst (.getRequestHeaders exchange) "Authorization")
                                   :body (body exchange)})
                 (case [method path]
                   ["GET" "/external/v1/worker/jobs"]
                   (respond! exchange 200 {:contract_version 1 :jobs [{:job_id 7}]})
                   ["POST" "/external/v1/worker/jobs/7/claim"]
                   (respond! exchange 200 {:job_id 7 :attempt 1 :url provider-url
                                           :external_product_id "p-1" :seller_article "sku-1"
                                           :config {:connector "json-api"} :cursor "old"})
                   ["POST" "/external/v1/worker/jobs/7/result"]
                   (respond! exchange 200 {:created 1 :updated 0 :failed 0})
                   (respond! exchange 404 {:error "unexpected"})))))]
    (try
      (worker/run-once! (http/client) {:cloud-base-url (str "http://127.0.0.1:" (.getPort (.getAddress api)))
                                       :worker-token "secret" :max-jobs 10
                                       :request-timeout-ms 3000 :allow-insecure-http? true})
      (let [requests @seen
            result-request (some #(when (= "/external/v1/worker/jobs/7/result" (:path %)) %) requests)
            result (json/read-str (:body result-request) :key-fn keyword)]
        (is (= "Bearer secret" (:auth (some #(when (= "/external/v1/worker/jobs" (:path %)) %) requests))))
        (is (= "cursor=old" (:query (some #(when (= "/reviews" (:path %)) %) requests))))
        (is (= 1 (:attempt result)))
        (is (= 1 (:contract_version result)))
        (is (= "next" (get-in result [:result :cursor])))
        (is (= {:provider_record_id "r-1"
                :external_product_id "p-1" :seller_article "sku-1"
                :author_name "Ada" :rating 5 :title "" :text "Useful"
                :pros "" :cons "" :created_at "2026-09-29T10:00:00Z" :url ""}
               (first (get-in result [:result :records]))))
        (is (nil? (some #(when (= "/external/v1/worker/jobs/7/finish" (:path %)) %) requests))))
      (finally (.stop api 0) (.stop provider 0)))))

(deftest connector-failure-is-reported-without-result
  (let [seen (atom [])
        api (server
             (fn [exchange]
               (let [path (.getPath (.getRequestURI exchange))
                     method (.getRequestMethod exchange)]
                 (swap! seen conj {:path path :body (body exchange)})
                 (case [method path]
                   ["GET" "/external/v1/worker/jobs"] (respond! exchange 200 {:contract_version 1 :jobs [{:job_id 9}]})
                   ["POST" "/external/v1/worker/jobs/9/claim"]
                   (respond! exchange 200 {:job_id 9 :attempt 1 :url "https://example.test" :config {:connector "unknown"}})
                   ["POST" "/external/v1/worker/jobs/9/finish"] (respond! exchange 200 {:ok true})
                   (respond! exchange 404 {:error "unexpected"})))))]
    (try
      (worker/run-once! (http/client) {:cloud-base-url (str "http://127.0.0.1:" (.getPort (.getAddress api)))
                                       :worker-token "secret" :max-jobs 10
                                       :request-timeout-ms 3000 :allow-insecure-http? true})
      (let [paths (map :path @seen)
            failure (json/read-str (:body (some #(when (= "/external/v1/worker/jobs/9/finish" (:path %)) %) @seen)) :key-fn keyword)]
        (is (not-any? #{"/external/v1/worker/jobs/9/result"} paths))
        (is (= 1 (:attempt failure)))
        (is (= "failed" (:status failure)))
        (is (re-find #"Unsupported connector" (:error failure))))
      (finally (.stop api 0)))))

(deftest json-api-provider-id-does-not-claim-marketplace-id
  (let [seen (atom nil)
        provider (server (fn [exchange] (respond! exchange 200 {:cursor "next" :records [{:id "provider-only" :created_at "2026-09-29T10:00:00Z" :body "Good"}]})))
        url (str "http://127.0.0.1:" (.getPort (.getAddress provider)) "/reviews")
        api (server (fn [exchange]
                      (let [path (.getPath (.getRequestURI exchange))]
                        (case [(.getRequestMethod exchange) path]
                          ["GET" "/external/v1/worker/jobs"] (respond! exchange 200 {:contract_version 1 :jobs [{:job_id 8}]})
                          ["POST" "/external/v1/worker/jobs/8/claim"] (respond! exchange 200 {:job_id 8 :attempt 1 :url url :config {:connector "json-api"}})
                          ["POST" "/external/v1/worker/jobs/8/result"] (do (reset! seen (json/read-str (body exchange) :key-fn keyword)) (respond! exchange 200 {:created 1}))
                          (respond! exchange 404 {:error "unexpected"}))))) ]
    (try
      (worker/run-once! (http/client) {:cloud-base-url (str "http://127.0.0.1:" (.getPort (.getAddress api))) :worker-token "secret" :max-jobs 1 :request-timeout-ms 3000 :allow-insecure-http? true})
      (let [record (first (get-in @seen [:result :records]))]
        (is (= "provider-only" (:provider_record_id record)))
        (is (nil? (:marketplace_review_id record))))
      (finally (.stop api 0) (.stop provider 0)))))
