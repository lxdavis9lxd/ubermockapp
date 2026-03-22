import axios from "axios";

/**
 * Axios-powered API client with CRUD helpers.
 */

export class ApiClient {
  constructor(baseURL = "") {
    this.instance = axios.create({
      baseURL,
      headers: { "Content-Type": "application/json" }
    });

    this.instance.interceptors.response.use(
      (res) => res,
      (err) => {
        const message = err?.response?.data?.message || err?.message || "Request failed";
        return Promise.reject(new Error(message));
      }
    );
  }

  setToken(token) {
    if (token) {
      this.instance.defaults.headers.common["Authorization"] = "Bearer " + token;
    } else {
      delete this.instance.defaults.headers.common["Authorization"];
    }
  }

  async request(config) {
    try {
      const res = await this.instance.request(config);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAll(url, config = {}) {
    return this.request({ url, method: "GET", ...config });
  }

  async getOne(url, config = {}) {
    return this.request({ url, method: "GET", ...config });
  }

  async create(url, data, config = {}) {
    return this.request({ url, method: "POST", data, ...config });
  }

  async update(url, data, config = {}) {
    return this.request({ url, method: "PUT", data, ...config });
  }

  async patch(url, data, config = {}) {
    return this.request({ url, method: "PATCH", data, ...config });
  }

  async delete(url, config = {}) {
    return this.request({ url, method: "DELETE", ...config });
  }
}

const apiClient = new ApiClient(import.meta.env.VITE_API_BASE_URL || "");
apiClient.instance.interceptors.request.use((config) => {
  config.params = { ...config.params, api_key: import.meta.env.VITE_API_MOVIEDB_TOKEN };
  return config;
});
export default apiClient;
