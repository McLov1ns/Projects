from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def get_species(self):
        self.client.get("/pollution/species")

    @task
    def get_bounds(self):
        self.client.get("/pollution/bounds")

    @task
    def get_image(self):
        self.client.get("/pollution/image?time_index=150&level_index=5&species=CO&data_type=trajReconstructed")

    @task
    def login(self):
        self.client.post("/login", json={"login": "admin", "password": "admin123"})
