import { useState } from "react";
import { toast } from "sonner";

const useFetch = (cb) => {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  //It uses rest parameters (...args) to accept any number or type of arguments.
  const fn = async (...args) => {
    console.log("useFetch called with args:", args);
    setLoading(true);
    setError(null);

    try {
      const response = await cb(...args);
      console.log("Server action response:", response);
      
      // Check if response has success: false (error from server action)
      if (response && response.success === false) {
        console.error("Server returned error:", response.error);
        setError(response.error);
        toast.error(response.error || "An error occurred");
        setData(response);
      } else {
        console.log("Server action succeeded, setting data");
        setData(response);
        setError(null);
      }
    } catch (error) {
      console.error("useFetch caught error:", error);
      setError(error);
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };
  return { data, loading, error, fn, setData };
};

export default useFetch;
