(ns external-sources.worker
  (:refer-clojure :exclude [run!])
  (:require [external-sources.connectors.json-api :as json-api]
            [external-sources.http :as http]))

(def ^:private jobs-path "/external/v1/worker/jobs")

(defn- auth-headers [token] {"Authorization" (str "Bearer " token)})
(defn- job-path [id action] (str jobs-path "/" id "/" action))
(defn- endpoint [config path] (str (:cloud-base-url config) path))

(defn- api [client config method path & [body]]
  (http/request-json client {:method method
                             :url (endpoint config path)
                             :headers (auth-headers (:worker-token config))
                             :body body
                             :timeout-ms (:request-timeout-ms config)}))

(defn poll [client config]
  (let [response (api client config :get jobs-path)]
    (when-not (= 1 (:contract_version response))
      (throw (ex-info "Unsupported worker contract version" {:contract_version (:contract_version response)})))
    (when-not (sequential? (:jobs response))
      (throw (ex-info "Worker poll response must contain a jobs array" {})))
    (take (:max-jobs config) (:jobs response))))

(defn- connector [job]
  (let [kind (or (get-in job [:config :connector]) "json-api")]
    (case kind
      "json-api" json-api/execute
      (throw (ex-info (str "Unsupported connector " kind) {:connector kind})))))

(defn run-job!
  "Claim, execute, and report one job. Cursor is held only in the result payload;
   the worker has no local cursor state."
  [client config offered-job]
  (let [id (:job_id offered-job)
        job (api client config :post (job-path id "claim"))]
    (try
      (let [result ((connector job) client job config)]
        (api client config :post (job-path id "result")
	             {:contract_version 1 :attempt (:attempt job) :result result}))
      (catch Exception ex
        (let [message (or (ex-message ex) (.getName (class ex)))]
          (try
            (api client config :post (job-path id "finish")
	                 {:attempt (:attempt job) :status "failed" :error (subs message 0 (min 2000 (count message)))})
            (catch Exception finish-ex
              (binding [*out* *err*]
                (println "Could not report failure for job" id ":" (ex-message finish-ex)))))
          (throw ex))))))

(defn run-once! [client config]
  (doseq [job (poll client config)]
    (try
      (run-job! client config job)
      (catch Exception ex
        (binding [*out* *err*]
          (println "Job" (:job_id job) "failed:" (ex-message ex)))))))

(defn run! [config]
  (let [client (http/client)]
    (loop []
      (try
        (run-once! client config)
        (catch Exception ex
          (binding [*out* *err*]
            (println "Worker poll failed:" (ex-message ex)))))
      (Thread/sleep (:poll-interval-ms config))
      (recur))))
