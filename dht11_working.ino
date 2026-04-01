#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <DHT.h>

#define DHTPIN D2
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

// WiFi credentials
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// Supabase details
const char* supabaseUrl = "https://xubpyvplopdcuhlngrxh.supabase.co/rest/v1/sensor_data";
const char* supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1YnB5dnBsb3BkY3VobG5ncnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMjQ4OTEsImV4cCI6MjA4ODcwMDg5MX0.wfnigqncwBmckraRazS9BO8iBnKM7ucX6600SrrY8fU";

void setup() {
  Serial.begin(9600);
  dht.begin();

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
}

void loop() {
  float tc = dht.readTemperature();
  float tf = dht.readTemperature(true);
  float hu = dht.readHumidity();

  if (isnan(tc) || isnan(tf) || isnan(hu)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }

  Serial.println("Sending data to Supabase...");

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;

    http.begin(client, supabaseUrl);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", supabaseKey);
    http.addHeader("Authorization", String("Bearer ") + supabaseKey);
    http.addHeader("Prefer", "return=minimal");

    String jsonData = "{";
    jsonData += "\"temperature_c\":" + String(tc) + ",";
    jsonData += "\"temperature_f\":" + String(tf) + ",";
    jsonData += "\"humidity\":" + String(hu);
    jsonData += "}";

    int httpResponseCode = http.POST(jsonData);

    if (httpResponseCode > 0) {
      Serial.print("Data sent! Response code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Error sending data: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  }

  delay(2000);
}
