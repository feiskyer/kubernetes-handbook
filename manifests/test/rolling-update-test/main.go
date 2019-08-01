package main

import (
	"fmt"
	"log"
	"net/http"
)

func sayhello(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "This is version 1.") //這個寫入到w的是輸出到客戶端的
}

func main() {
	http.HandleFunc("/", sayhello) //設置訪問的路由
	log.Println("This is version 1.")
	err := http.ListenAndServe(":9090", nil) //設置監聽的端口
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
