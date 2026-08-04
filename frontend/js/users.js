function getUserId() {
    return localStorage.getItem("userId") || 1;
}