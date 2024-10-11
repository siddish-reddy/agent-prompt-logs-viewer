import { useState, useEffect, useMemo } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { ScrollArea } from "./components/ui/scroll-area";
import { Highlight } from "./components/Highlight"; // We'll create this component

import JsonView from "@uiw/react-json-view";
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import { Textarea } from "./components/ui/textarea";
import EventTimeline from "./components/EventTimeline"; // Import the new component
import { v4 as uuidv4 } from 'uuid'; // Import UUID

const App = () => {
  interface Turn {
    role: string;
    content: string;
  }

  interface Log {
    id: string; // Add this line
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

  interface Event {
    id: string;
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
    type?: string;
    details?: any;
  }

  const [data, setData] = useState<Data>({
    logs: [],
    total_cost_usd: 0,
    total_duration_s: 0,
  });
  const [alert, setAlert] = useState({ show: false, message: "", type: "" });
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [showLastTurn, setShowLastTurn] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [searchTerm, setSearchTerm] = useState("");
  const [eventNameFilter, setEventNameFilter] = useState("");
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

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
        id: uuidv4(), // Assign a unique UUID here
        model: model,
        prompt: prompt_array,
        response: response,
        duration_ms: parseInt(duration_ms),
        // associated_event_name: associated_event_name.replace("DOC_TO_SURVEY_", "").replace("_EXECUTOR_GENERATED", ""),
        associated_event_name: associated_event_name.replace("DOC_TO_SURVEY_", ""),
        timestamp: timestamp,
        prompt_tokens: parseInt(prompt_token_count),
        completion_tokens: parseInt(completion_token_count),
        error: error,
        schema: "",
      };
    } catch (error) {
      console.error(error);
      return {
        id: uuidv4(), // Assign a unique UUID even in error case
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
    // Pricing per million tokens (in USD)
    const gpt_4o_input_cost = 2.5;
    const gpt_4o_output_cost = 10;
    const gpt_4o_mini_input_cost = 0.15; // Estimated based on the ratio of GPT-4o
    const gpt_4o_mini_output_cost = 0.6; // Estimated based on the ratio of GPT-4o
    const gemini_2_flash_input_cost = 0.07;
    const gemini_2_flash_output_cost = 0.3;

    return logs.reduce((total, log) => {
      const inputCost = log.prompt_tokens / 1_000_000;
      const outputCost = log.completion_tokens / 1_000_000;

      if (log.model.includes("4o-mini")) {
        return total + 
          (inputCost * gpt_4o_mini_input_cost) + 
          (outputCost * gpt_4o_mini_output_cost);
      } else if (log.model.includes("4o")) {
        return total + 
          (inputCost * gpt_4o_input_cost) + 
          (outputCost * gpt_4o_output_cost);
      } else if (log.model.includes("gemini")) {
        return total + 
          ((inputCost + outputCost) * gemini_2_flash_input_cost) + 
          ((inputCost + outputCost) * gemini_2_flash_output_cost);
      }
      return total;
    }, 0);
  };

  const calculateTotalDuration = (logs: Log[]) => {
    if (logs.length === 0) return 0;
    const startTime = Math.min(...logs.map(log => new Date(log.timestamp).getTime()));
    const endTime = Math.max(...logs.map(log => new Date(log.timestamp).getTime() + log.duration_ms));
    return (endTime - startTime) / 1000;
  };

  const pasteFromClipboard = () => {
    navigator.clipboard
      .readText()
      .then((text) => {
        try {
          const log_lines = text.split("\n");
          const logs = log_lines
            .map((log_line, index) => {
              const log = parseSingleLog(log_line);
              log.id = index.toString(); // Assign a unique ID
              return log;
            })
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

  // Update this function to use the correct timestamp format
  const transformLogsToEvents = (logs: Log[]): Event[] => {
    return logs.map((log) => ({
      id: log.id, // Use the log's unique UUID
      name: log.associated_event_name,
      startTime: new Date(log.timestamp).getTime(),
      endTime: new Date(log.timestamp).getTime() + log.duration_ms,
      duration: log.duration_ms,
      type: log.model,
      details: {
        promptTokens: log.prompt_tokens,
        completionTokens: log.completion_tokens,
        error: log.error,
      },
    }));
  };

  // Transform logs to events
  const events = transformLogsToEvents(data.logs);

  const handleEventClick = (event: Event) => {
    const correspondingLog = data.logs.find(
      (log) => log.id === event.id
    );
    if (correspondingLog) {
      setSelectedLog(correspondingLog);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredLogs = useMemo(() => {
    return sortedLogs.filter((log) => {
      const matchesSearch =
        searchTerm === "" ||
        JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEventName =
        eventNameFilter === "" ||
        log.associated_event_name.toLowerCase().includes(eventNameFilter.toLowerCase());
      const matchesErrorFilter = !showErrorsOnly || log.error;
      return matchesSearch && matchesEventName && matchesErrorFilter;
    });
  }, [sortedLogs, searchTerm, eventNameFilter, showErrorsOnly]);

  const bottlenecks = useMemo(() => {
    const threshold = data.total_duration_s * 0.1; // 10% of total duration
    return filteredLogs.filter((log, index, array) => {
      if (log.duration_ms <= threshold) return false;
      
      const logStart = new Date(log.timestamp).getTime();
      const logEnd = logStart + log.duration_ms;
      
      // Check if there are any overlapping events
      const hasOverlap = array.some((otherLog, otherIndex) => {
        if (index === otherIndex) return false;
        const otherStart = new Date(otherLog.timestamp).getTime();
        const otherEnd = otherStart + otherLog.duration_ms;
        return (otherStart < logEnd && otherEnd > logStart);
      });
      
      return !hasOverlap;
    });
  }, [filteredLogs, data.total_duration_s]);

  return (
    <div className="flex flex-col min-h-screen w-[100vw] bg-slate-900 text-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex flex-col space-y-2 p-4 bg-slate-800 border-b border-slate-700 shadow-sm mb-4 px-[5vw]">
        <div className="flex justify-between items-center w-full">
          <h1 className="text-2xl font-bold mr-4 text-white">Agent Prompt Logs Viewer</h1>
          <Button
            onClick={pasteFromClipboard}
            variant={"outline"}
            className="ml-4 border-2 border-slate-200 bg-slate-900 text-white hover:bg-slate-700 border-slate-400 :text-slate-100 hover:bg-slate-600"
          >
            <ClipboardCheck className="mr-2 h-4 w-4" /> Paste from Clipboard
          </Button>
        </div>
        {/* Meta Data */}
        <div className="flex space-x-4 text-slate-100">
          <div>
            Total Cost: ${data.total_cost_usd.toFixed(3)} / INR{" "}
            {Math.round(data.total_cost_usd * 85)}
          </div>
          <div>Total Duration: {data.total_duration_s} seconds</div>
        </div>
        {alert.show && (
          <Alert
            className={`mb-4 ${
              alert.type === "success" ? "bg-green-800 text-green-100" : "bg-red-800 text-red-100"
            }`}
          >
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Add the EventTimeline component */}
      <div className="w-full p-4">
        <h2 className="text-xl font-semibold mb-2 text-white">Event Timeline</h2>
        <EventTimeline
          events={events}
          width={windowSize.width - 40}
          height={400}
          onEventClick={handleEventClick}
          selectedEventId={selectedLog?.id} // Pass the selected event ID
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 pl-[1vw] pr-[5vw] w-full">
        {/* Sidebar with Event Names and Filters */}
        <div 
          className="w-[450px] border-r border-slate-800 pr-4 overflow-y-auto"
          style={{
            position: 'sticky',
            top: 'calc(100px + 20px)', // Adjust the top value to account for header and timeline heights
            maxHeight: 'calc(100vh - 120px)', // Adjust the height accordingly
          }}
        >
          <h2 className="text-xl font-semibold mb-2 text-white">Filters</h2>
          <div className="space-y-4 mb-4">
            <div>
              <Label htmlFor="search" className="text-white">Search</Label>
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search in logs..."
                className="bg-slate-800 text-white border-slate-700"
              />
            </div>
            <div>
              <Label htmlFor="eventFilter" className="text-white">Filter by Event Name</Label>
              <Input
                id="eventFilter"
                value={eventNameFilter}
                onChange={(e) => setEventNameFilter(e.target.value)}
                placeholder="Filter events..."
                className="bg-slate-800 text-white border-slate-700"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={showErrorsOnly}
                onCheckedChange={setShowErrorsOnly}
                id="show-errors"
                className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-600"
              />
              <Label htmlFor="show-errors" className="text-white">Show Errors Only</Label>
            </div>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-white">Events</h2>
          <ScrollArea className="h-[calc(100vh-300px)]">
            <ul>
              {filteredLogs.map((log, index) => (
                <li
                  key={index}
                  className={`cursor-pointer p-2 rounded ${
                    selectedLog === log ? "bg-blue-900" : "hover:bg-slate-700"
                  } ${log.error ? "border-l-4 border-red-500" : ""}`}
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm truncate text-slate-100">
                      {log.associated_event_name}
                    </span>
                    <span className="text-xs text-slate-300">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    {log.error && (
                      <span className="text-xs text-red-400">Error</span>
                    )}
                    {bottlenecks.includes(log) && (
                      <span className="text-xs text-yellow-400">Bottleneck</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        {/* Log Details */}
        <div className="flex-1 pl-4 w-full overflow-y-auto">
          {selectedLog ? (
            <div className="flex flex-col space-y-6">
              {/* Log Meta Data */}
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="bg-slate-600 text-white">{selectedLog.model}</Badge>
                <Badge variant="secondary" className="bg-slate-600 text-white">{selectedLog.duration_ms} ms</Badge>
                <Badge variant="secondary" className="bg-slate-600 text-white">
                  {selectedLog.prompt_tokens} prompt tokens
                </Badge>
                <Badge variant="secondary" className="bg-slate-600 text-white">
                  {selectedLog.completion_tokens} completion tokens
                </Badge>
                {selectedLog.error && (
                  <Badge variant="destructive" className="bg-red-800 text-red-100">
                    Error: {selectedLog.error}
                  </Badge>
                )}
              </div>

              {/* Last User Turn */}
              <div className="mt-6 text-white">
                <div className="flex items-center mb-2">
                  <h2 className="text-xl font-semibold text-white">Last User Turn</h2>
                  <div className="flex items-center space-x-2 ml-10">
                    <Switch
                      checked={showLastTurn}
                      onCheckedChange={setShowLastTurn}
                      id="show-last-turn"
                      className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-600"
                    />
                    <label htmlFor="show-last-turn" style={{ paddingRight: 15 }} className="text-slate-100">
                      {showLastTurn ? "Hide" : "Show"}
                    </label>
                  </div>
                </div>
                {showLastTurn && (
                  <Card className="py-3 bg-slate-800 border-slate-800">
                    {selectedLog.prompt[selectedLog.prompt.length - 1] !== "REDUCED_DUE_TO_SIZE_LIMIT" ? (
                      <CardContent>
                        {isJSON(
                          (selectedLog.prompt[selectedLog.prompt.length - 1] as Turn).content
                        ) ? (
                          <Highlight
                            object={JSON.parse(
                              (selectedLog.prompt[selectedLog.prompt.length - 1] as Turn).content
                            )}
                            searchTerm={searchTerm}
                          />
                        ) : (
                          <Highlight
                            text={(selectedLog.prompt[selectedLog.prompt.length - 1] as Turn).content}
                            searchTerm={searchTerm}
                          />
                        )}
                      </CardContent>
                    ) : (
                      <div className="text-red-400 mb-2">
                        Turn was reduced due to size limit.
                      </div>
                    )}
                  </Card>
                )}
              </div>

              {/* Main Response */}
              <div className="mt-6">
                <h2 className="text-xl font-semibold mb-2 text-white">Response</h2>
                <Card className="p-4 bg-slate-800 border-slate-700">
                  <CardContent>
                    {isJSON(selectedLog.response) ? (
                      <Highlight
                        object={JSON.parse(selectedLog.response)}
                        searchTerm={searchTerm}
                      />
                    ) : (
                      <Highlight
                        text={selectedLog.response}
                        searchTerm={searchTerm}
                      />
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
                              ? "bg-blue-900 text-blue-100"
                              : "bg-green-900 text-green-100"
                          }`}
                        >
                          {turn.role}
                        </Badge>
                        {/* Content */}
                        <div
                          className={`flex-1 rounded-lg shadow`}
                        >
                          {isJSON(turn.content) ? (
                            <JsonView
                              value={JSON.parse(turn.content)}
                              collapsed={4}
                              shortenTextAfterLength={2000}
                              style={{ ...vscodeTheme, fontSize: "1.15em" }}
                              displayDataTypes={false}
                              />
                          ) : (
                            <Textarea
                              value={turn.content}
                              onChange={() => {}}
                              placeholder={`Turn ${idx + 1} - ${turn.role}`}
                              className="mb-2 p-2 rounded resize-none text-white border-slate-700"
                              rows={
                                turn.content.split("\n").length +
                                turn.content
                                  .split("\n")
                                  .filter((line) => line.length > 150).length
                              }
                              readOnly
                              style={{
                                fontSize: "1.15em",
                                lineHeight: "1.5",
                                fontFamily: "Verdana",
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
            <div className="text-center text-slate-400">
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