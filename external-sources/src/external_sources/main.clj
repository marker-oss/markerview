(ns external-sources.main
  (:gen-class)
  (:require [external-sources.config :as config]
            [external-sources.worker :as worker]))

(defn -main [& _]
  (try
    (worker/run! (config/load))
    (catch clojure.lang.ExceptionInfo ex
      (binding [*out* *err*]
        (println "Worker configuration error:" (ex-message ex) (pr-str (ex-data ex))))
      (System/exit 1))))
