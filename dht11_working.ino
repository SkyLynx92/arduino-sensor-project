#include <DHT.h>

#define DHTPIN D2        // NodeMCU pin (easier than GPIO number)
#define DHTTYPE DHT11   // DHT11 or DHT22

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);   // ESP8266 standard speed
  dht.begin();

  Serial.println("DHT Sensor Started...");
}

void loop() {

  float tc = dht.readTemperature();     // Celsius
  float tf = dht.readTemperature(true); // Fahrenheit
  float hu = dht.readHumidity();        // Humidity

  // Check if reading failed
  if (isnan(tc) || isnan(tf) || isnan(hu)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }

  Serial.print("Temperature: ");
  Serial.print(tc);
  Serial.print(" °C  |  ");
  Serial.print(tf);
  Serial.print(" °F  |  Humidity: ");
  Serial.print(hu);
  Serial.println(" %");

  delay(2000);
}
