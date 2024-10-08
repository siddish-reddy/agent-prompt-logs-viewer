import { useState, useEffect } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import JsonView from "@uiw/react-json-view";
import { Textarea } from "./components/ui/textarea";

const App = () => {
  interface Turn {
    role: string;
    content: string;
  }

  interface Log {
    associated_event_name: string;
    timestamp: string;
    model: string;
    prompt: (Turn | "REDUCED_DUE_TO_SIZE_LIMIT")[];
    response: string; // can be string or dumped json object
    prompt_tokens: number;
    completion_tokens: number;
    duration_ms: number;
    schema: string; // json schema used for the response
    error: string;
  }

  interface Data {
    logs: Log[];
    total_cost_usd: number;
    total_duration_s: number;
  }

  const [data, setData] = useState<Data>({
    logs: [],
    total_cost_usd: 0,
    total_duration_s: 0,
  });
  const [alert, setAlert] = useState({ show: false, message: "", type: "" });
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [showLastTurn, setShowLastTurn] = useState(true);

  useEffect(() => {
    localStorage.setItem("jsonPromptData", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (data.logs.length > 0 && !selectedLog) {
      setSelectedLog(data.logs[0]);
    }
  }, [data.logs, selectedLog]);

  const parseSingleLog = (log_line: string): Log => {
    //  sample log line text
    try {
      // parse the tab separated values
      const log_data = log_line.split("\t");
      const prompt = log_data[0];
      const response = log_data[1];
      const duration_ms = log_data[2];
      const associated_event_name = log_data[3];
      const timestamp = log_data[4];
      const model = log_data[5];
      // const provider = log_data[6];
      // const sentry_trace_id = log_data[7];
      const prompt_token_count = log_data[8];
      const completion_token_count = log_data[9];
      const error = log_data[10];

      const prompt_array = JSON.parse(prompt);

      return {
        model: model,
        prompt: prompt_array,
        response: response,
        duration_ms: parseInt(duration_ms),
        associated_event_name: associated_event_name,
        timestamp: timestamp,
        prompt_tokens: parseInt(prompt_token_count),
        completion_tokens: parseInt(completion_token_count),
        error: error,
        schema: "",
      };
    } catch (error) {
      console.error(error);
      return {
        model: "",
        prompt: [],
        response: "",
        duration_ms: 0,
        associated_event_name: "",
        timestamp: "",
        prompt_tokens: 0,
        completion_tokens: 0,
        error: "",
        schema: "",
      };
    }
  };

  const calculateTotalCost = (logs: Log[]) => {
    const gpt_4o_mini_cost_per_million_tokens = 0.00015;
    const gpt_4o_cost_per_million_tokens = 0.0003;
    const gemini_2_flash_cost_per_million_tokens = 0.3;

    return logs.reduce((total, log) => {
      if (log.model.includes("4o-mini")) {
        return (
          total + log.completion_tokens * gpt_4o_mini_cost_per_million_tokens
        );
      } else if (log.model.includes("4o")) {
        return total + log.completion_tokens * gpt_4o_cost_per_million_tokens;
      } else if (log.model.includes("gemini")) {
        return (
          total + log.completion_tokens * gemini_2_flash_cost_per_million_tokens
        );
      }
      return total;
    }, 0);
  };

  const calculateTotalDuration = (logs: Log[]) => {
    return (
      logs.reduce((total, log) => {
        return total + log.duration_ms;
      }, 0) / 1000
    );
  };

  const pasteFromClipboard = () => {
    navigator.clipboard
      .readText()
      .then((text) => {
        try {
          // for each line in the text, parse the log line and add it to the data
          const log_lines = text.split("\n");
          const logs = log_lines
            .map(parseSingleLog)
            .filter((log) => log.model !== "");
          const total_cost = calculateTotalCost(logs);
          const total_duration = calculateTotalDuration(logs);
          setData({
            logs: logs,
            total_cost_usd: total_cost,
            total_duration_s: total_duration,
          });

          setAlert({
            show: true,
            message: "Data pasted successfully!",
            type: "success",
          });
          setTimeout(
            () => setAlert({ show: false, message: "", type: "" }),
            3000
          );
        } catch (error) {
          setAlert({
            show: true,
            message: "Invalid data format.",
            type: "error",
          });
          setTimeout(
            () => setAlert({ show: false, message: "", type: "" }),
            3000
          );
        }
      })
      .catch(() => {
        setAlert({
          show: true,
          message: "Failed to read clipboard.",
          type: "error",
        });
        setTimeout(
          () => setAlert({ show: false, message: "", type: "" }),
          3000
        );
      });
  };

  const sortedLogs = [...data.logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="flex flex-col min-h-screen w-[100vw] px-[0.5vw]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex flex-col space-y-2 p-4 bg-white border-b shadow-sm mb-4 px-[5vw]">
        <div className="flex justify-between items-center w-full">
          <h1 className="text-2xl font-bold mr-4">Agent Prompt Logs Viewer</h1>
          <Button
            onClick={pasteFromClipboard}
            variant={"outline"}
            className="ml-4 border-2 border-slate-400"
          >
            <ClipboardCheck className="mr-2 h-4 w-4" /> Paste from Clipboard
          </Button>
        </div>
        {/* Meta Data */}
        <div className="flex space-x-4">
          <div>
            Total Cost: ${data.total_cost_usd.toFixed(3)} / INR{" "}
            {Math.round(data.total_cost_usd * 85)}
          </div>
          <div>Total Duration: {data.total_duration_s} seconds</div>
        </div>
        {alert.show && (
          <Alert
            className={`mb-4 ${
              alert.type === "success" ? "bg-green-100" : "bg-red-100"
            }`}
          >
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 pl-[1vw] pr-[5vw] w-full">
        {/* Sidebar with Event Names */}
        <div className="w-[400px]  border-r pr-4 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-2">Events</h2>
          <ul>
            {sortedLogs.map((log, index) => (
              <li
                key={index}
                className={`cursor-pointer p-2 rounded ${
                  selectedLog === log ? "bg-blue-200" : "hover:bg-gray-100"
                }`}
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-sm truncate">
                    {log.associated_event_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Log Details */}
        <div className="flex-1 pl-4 w-full overflow-y-auto">
          {selectedLog ? (
            <div className="flex flex-col space-y-6">
              {/* Log Meta Data */}
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary">{selectedLog.model}</Badge>
                <Badge variant="secondary">{selectedLog.duration_ms} ms</Badge>
                <Badge variant="secondary">
                  {selectedLog.prompt_tokens} prompt tokens
                </Badge>
                <Badge variant="secondary">
                  {selectedLog.completion_tokens} completion tokens
                </Badge>
                {selectedLog.error && (
                  <Badge variant="destructive">
                    Error: {selectedLog.error}
                  </Badge>
                )}
              </div>

              {/* Last User Turn */}
              <div className="mt-6">
                <div className="flex items-center mb-2">
                  <h2 className="text-xl font-semibold">Last User Turn</h2>
                  <div className="flex items-center space-x-2 ml-10">
                    <Switch
                      checked={showLastTurn}
                      onCheckedChange={setShowLastTurn}
                      id="show-last-turn"
                    />
                    <label htmlFor="show-last-turn" style={{ paddingRight: 15 }}>
                      {showLastTurn ? "Hide" : "Show"}
                    </label>
                  </div>
                </div>
                {showLastTurn && (
                  <Card className="p-4">
                    {/* check if the last turn is a valid turn */}
                    {selectedLog.prompt[selectedLog.prompt.length - 1] !== "REDUCED_DUE_TO_SIZE_LIMIT" ? (
                    <CardContent>
                      {isJSON(
                        (selectedLog.prompt[selectedLog.prompt.length - 1] as Turn).content
                      ) ? (
                        <JsonView
                        value={JSON.parse(
                          selectedLog.prompt[selectedLog.prompt.length - 1].content
                        )}
                        collapsed={4}
                        shortenTextAfterLength={2000}
                        style={{ fontSize: "1.15em" }} // Enhanced font size
                          displayDataTypes={false}
                        />
                      ) : (
                        <Textarea
                          value={
                            selectedLog.prompt[selectedLog.prompt.length - 1].content
                          }
                          onChange={() => {}}
                          placeholder={`Last User Turn`}
                          className="mb-2 p-2 rounded resize-none"
                                rows={
                                  selectedLog.prompt[selectedLog.prompt.length - 1].content.split("\n").length +
                                  selectedLog.prompt[selectedLog.prompt.length - 1].content
                                    .split("\n")
                                    .filter((line) => line.length > 150).length
                                }
                                readOnly
                                style={{
                                  fontSize: "1.15em", // Enhanced font size
                                  lineHeight: "1.5",
                                  fontFamily: "Verdana",
                                  backgroundColor:
                                    selectedLog.prompt[selectedLog.prompt.length - 1].role === "user" ? "#EBF8FF" : "#F0FFF4", // Light blue for user, light green for assistant
                                }}
                        />
                      )}
                    </CardContent>) : (
                      <div className="text-red-400 mb-2">
                        Turn was reduced due to size limit.
                      </div>
                    )}
                  </Card>
                )}
              </div>

              {/* Main Response */}
              <div className="mt-6">
                <h2 className="text-xl font-semibold mb-2">Response</h2>
                <Card className="p-4">
                  <CardContent>
                    {isJSON(selectedLog.response) ? (
                      <JsonView
                        value={JSON.parse(selectedLog.response)}
                        collapsed={4}
                        shortenTextAfterLength={2000}
                        style={{ fontSize: "1.15em" }} // Enhanced font size
                        displayDataTypes={false}
                      />
                    ) : (
                      <pre
                        className="whitespace-pre-wrap"
                        style={{
                          fontSize: "1.1em",
                          backgroundColor: "#FFF7ED", // Light yellow background
                          padding: "1em",
                          borderRadius: "0.5em",
                        }}
                      >
                        {selectedLog.response}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Prompts and Responses */}
              <div className="space-y-4">
                {selectedLog.prompt.map((turn, idx) => (
                  <div key={idx} className="flex items-start space-x-4">
                    {turn !== "REDUCED_DUE_TO_SIZE_LIMIT" ? (
                      <>
                        {/* Role Badge */}
                        <Badge
                          variant="outline"
                          className={`capitalize ${
                            turn.role === "user"
                              ? "bg-blue-200 text-blue-900"
                              : "bg-green-200 text-green-900"
                          }`}
                        >
                          {turn.role}
                        </Badge>
                        {/* Content */}
                        <div
                          className={`flex-1 p-4 rounded-lg shadow ${
                            turn.role === "user" ? "bg-blue-50" : "bg-green-50"
                          }`}
                        >
                          {isJSON(turn.content) ? (
                            <JsonView
                              value={JSON.parse(turn.content)}
                              collapsed={4}
                              shortenTextAfterLength={2000}
                              style={{ fontSize: "1.15em" }} // Enhanced font size
                            />
                          ) : (
                            <Textarea
                              value={turn.content}
                              onChange={() => {}}
                              placeholder={`Turn ${idx + 1} - ${turn.role}`}
                              className="mb-2 p-2 rounded resize-none"
                              rows={
                                turn.content.split("\n").length +
                                turn.content
                                  .split("\n")
                                  .filter((line) => line.length > 150).length
                              }
                              readOnly
                              style={{
                                fontSize: "1.15em", // Enhanced font size
                                lineHeight: "1.5",
                                fontFamily: "Verdana",
                                backgroundColor:
                                  turn.role === "user" ? "#EBF8FF" : "#F0FFF4", // Light blue for user, light green for assistant
                              }}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-red-400 mb-2">
                        Turn was reduced due to size limit.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              Select an event to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Utility function to check if a string is valid JSON
const isJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

export default App;