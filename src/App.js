import "./styles.css";
import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Info,
  Plus,
  X,
} from "lucide-react";

const GlulamNDTApp = () => {
  const [step, setStep] = useState(1);
  const [beamLength, setBeamLength] = useState("");
  const [measurements, setMeasurements] = useState([{ position: "", tof: "" }]);
  const [analysis, setAnalysis] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [layerData, setLayerData] = useState({});
  const [layerAnalysis, setLayerAnalysis] = useState(null);

  const layerPositions = [1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6, 6.3, 7.0];
  const actualLayerPositions = [0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6, 6.3];
  const layerNames = [
    "Mid-L1",
    "GL1",
    "Mid-L2",
    "GL2",
    "Mid-L3",
    "GL3",
    "Mid-L4",
    "GL4",
    "Mid-L5",
  ];

  const addMeasurement = () => {
    setMeasurements([...measurements, { position: "", tof: "" }]);
  };

  const removeMeasurement = (index) => {
    if (measurements.length > 1) {
      setMeasurements(measurements.filter((_, i) => i !== index));
    }
  };

  const updateMeasurement = (index, field, value) => {
    const updated = [...measurements];
    updated[index][field] = value;
    setMeasurements(updated);
  };

  const analyzeThicknessData = () => {
    const validData = measurements
      .filter((m) => m.position !== "" && m.tof !== "")
      .map((m) => ({
        position: parseFloat(m.position),
        tof: parseFloat(m.tof),
      }))
      .sort((a, b) => a.position - b.position);

    if (validData.length < 3) {
      alert("Please enter at least 3 measurements to analyze");
      return;
    }

    const beamLengthInches = beamLength === "8ft" ? 96 : 144;
    const edgeThreshold = 10;

    const interiorData = validData.filter(
      (d) =>
        d.position > edgeThreshold &&
        d.position < beamLengthInches - edgeThreshold
    );

    if (interiorData.length < 3) {
      alert(
        "Not enough interior measurements. Please add more measurements away from beam ends."
      );
      return;
    }

    const mean =
      interiorData.reduce((sum, d) => sum + d.tof, 0) / interiorData.length;
    const variance =
      interiorData.reduce((sum, d) => sum + Math.pow(d.tof - mean, 2), 0) /
      interiorData.length;
    const stdDev = Math.sqrt(variance);

    // Use absolute thresholds based on real data patterns
    const suspiciousThreshold = 140;
    const likelyThreshold = 150;
    const definiteThreshold = 170;

    const zones = [];
    let currentZone = null;

    validData.forEach((point) => {
      if (
        point.position <= edgeThreshold ||
        point.position >= beamLengthInches - edgeThreshold
      ) {
        return;
      }

      // Check if point is elevated (above 140 OR significantly above local baseline)
      const isElevated =
        point.tof > suspiciousThreshold || point.tof > mean + 10;

      if (isElevated) {
        if (!currentZone) {
          // Start new zone
          currentZone = {
            start: point.position,
            end: point.position,
            points: [point],
            maxTOF: point.tof,
            avgTOF: point.tof,
            minTOF: point.tof,
          };
        } else {
          // Extend zone if within 20 inches (captures gradual rise and fall)
          if (point.position - currentZone.end <= 20) {
            currentZone.end = point.position;
            currentZone.points.push(point);
            currentZone.maxTOF = Math.max(currentZone.maxTOF, point.tof);
            currentZone.minTOF = Math.min(currentZone.minTOF, point.tof);
            currentZone.avgTOF =
              currentZone.points.reduce((sum, p) => sum + p.tof, 0) /
              currentZone.points.length;
          } else {
            // Gap too large, save current zone and start new one
            if (currentZone.points.length >= 1) {
              zones.push(currentZone);
            }
            currentZone = {
              start: point.position,
              end: point.position,
              points: [point],
              maxTOF: point.tof,
              avgTOF: point.tof,
              minTOF: point.tof,
            };
          }
        }
      } else {
        // Not elevated - close current zone if exists
        if (currentZone && currentZone.points.length >= 1) {
          zones.push(currentZone);
        }
        currentZone = null;
      }
    });

    if (currentZone && currentZone.points.length >= 1) {
      zones.push(currentZone);
    }

    const recommendations = zones.map((zone) => {
      const spanLength = zone.end - zone.start;
      const pointCount = zone.points.length;

      let needsMoreData = false;
      let suggestedInterval = null;

      if (pointCount <= 2 && spanLength > 6) {
        needsMoreData = true;
        suggestedInterval = 2;
      } else if (spanLength > 20 && pointCount < 6) {
        needsMoreData = true;
        suggestedInterval = 2;
      }

      // Determine confidence based on peak TOF values
      let confidence;
      let severity;

      if (zone.maxTOF >= definiteThreshold) {
        confidence = "High";
        severity = "Severe";
      } else if (zone.maxTOF >= likelyThreshold) {
        confidence = "High";
        severity = "Moderate";
      } else if (zone.avgTOF >= suspiciousThreshold && pointCount >= 2) {
        confidence = "Medium";
        severity = "Mild";
      } else {
        confidence = "Low";
        severity = "Possible";
      }

      return {
        ...zone,
        needsMoreData,
        suggestedInterval,
        confidence,
        severity,
        elevationRatio: zone.avgTOF / mean,
      };
    });

    setAnalysis({
      zones: recommendations,
      suspiciousThreshold,
      likelyThreshold,
      definiteThreshold,
      mean,
      stdDev,
      hasDelamination: zones.length > 0,
    });

    if (zones.length > 0) {
      setStep(3);
    } else {
      setStep(4);
    }
  };

  const handleLayerInput = (layer, value) => {
    setLayerData((prev) => ({
      ...prev,
      [layer]: parseFloat(value) || "",
    }));
  };

  const analyzeLayerData = () => {
    const layerValues = layerPositions
      .map((layer, idx) => ({
        displayLayer: layer,
        actualPos: actualLayerPositions[idx],
        layerName: layerNames[idx],
        value: layerData[layer],
      }))
      .filter((item) => item.value !== undefined && item.value !== "");

    if (layerValues.length < 5) {
      alert("Please enter at least 5 layer measurements");
      return;
    }

    let identifiedLayers = [];

    for (let i = 1; i < layerValues.length; i++) {
      const prev = layerValues[i - 1].value;
      const curr = layerValues[i].value;

      if (prev > curr * 1.2) {
        const beforeValues = layerValues.slice(0, i).map((v) => v.value);
        const avgBefore =
          beforeValues.reduce((sum, v) => sum + v, 0) / beforeValues.length;

        if (avgBefore > curr * 1.15) {
          const prevLayer = layerValues[i - 1];

          identifiedLayers.push({
            depth: prevLayer.actualPos,
            displayDepth: prevLayer.displayLayer,
            layerName: prevLayer.layerName,
            confidence: prev > curr * 1.3 ? "High" : "Medium",
            dropRatio: (prev / curr).toFixed(2),
          });
        }
      }
    }

    layerValues.forEach((layer, idx) => {
      if (layer.layerName.startsWith("GL")) {
        const before = idx > 0 ? layerValues[idx - 1].value : null;
        const after =
          idx < layerValues.length - 1 ? layerValues[idx + 1].value : null;

        if (before && after) {
          const avgAdjacent = (before + after) / 2;
          if (layer.value > avgAdjacent * 1.3) {
            const alreadyIdentified = identifiedLayers.some(
              (il) => il.depth === layer.actualPos
            );
            if (!alreadyIdentified) {
              identifiedLayers.push({
                depth: layer.actualPos,
                displayDepth: layer.displayLayer,
                layerName: layer.layerName,
                confidence: "Medium",
                elevationRatio: (layer.value / avgAdjacent).toFixed(2),
              });
            }
          }
        }
      }
    });

    setLayerAnalysis({
      identifiedLayers,
      hasDelamination: identifiedLayers.length > 0,
    });

    setStep(4);
  };

  const renderBeamSchematic = () => {
    const beamLengthInches = beamLength === "8ft" ? 96 : 144;

    return (
      <div className="mt-8 p-6 bg-white border-2 border-gray-300 rounded-lg">
        <h3 className="text-2xl font-bold mb-6">Analysis Results</h3>

        <div className="mb-6">
          <h4 className="text-sm font-medium mb-2">Beam Length View:</h4>
          <div className="relative w-full h-24 bg-amber-100 border-2 border-amber-800 rounded">
            {analysis?.zones.map((zone, idx) => (
              <div
                key={idx}
                className={`absolute top-0 bottom-0 opacity-60 cursor-pointer hover:opacity-80 transition-all ${
                  zone.severity === "Severe"
                    ? "bg-red-600"
                    : zone.severity === "Moderate"
                    ? "bg-orange-500"
                    : zone.severity === "Mild"
                    ? "bg-yellow-400"
                    : "bg-blue-400"
                }`}
                style={{
                  left: `${(zone.start / beamLengthInches) * 100}%`,
                  width: `${
                    ((zone.end - zone.start) / beamLengthInches) * 100
                  }%`,
                }}
                onClick={() => setSelectedZone(zone)}
              >
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
                  Zone {idx + 1}
                </div>
              </div>
            ))}

            <div className="absolute -bottom-8 left-0 text-sm font-medium">
              0"
            </div>
            <div className="absolute -bottom-8 left-1/4 text-sm text-gray-500">
              {beamLengthInches / 4}"
            </div>
            <div className="absolute -bottom-8 left-1/2 text-sm text-gray-500">
              {beamLengthInches / 2}"
            </div>
            <div className="absolute -bottom-8 left-3/4 text-sm text-gray-500">
              {(beamLengthInches * 3) / 4}"
            </div>
            <div className="absolute -bottom-8 right-0 text-sm font-medium">
              {beamLengthInches}"
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-bold flex items-center gap-2">
              <Info className="w-5 h-5" />
              Beam Specifications
            </h4>
            <div className="mt-2 space-y-1">
              <p>
                Length: {beamLength} ({beamLengthInches} inches)
              </p>
              <p>Configuration: 6 lumber layers, 5 glue lines</p>
              <p className="text-sm text-gray-600">
                Baseline TOF: {analysis?.mean.toFixed(0)} μs (±
                {analysis?.stdDev.toFixed(0)} μs)
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Detection thresholds: Suspicious &gt;140μs, Likely &gt;150μs,
                Definite &gt;170μs
              </p>
            </div>
          </div>

          {analysis?.hasDelamination ? (
            <>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  Delamination Detected - {analysis.zones.length} Zone(s) Found
                </h4>
              </div>

              {analysis.zones.map((zone, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 ${
                    zone.severity === "Severe"
                      ? "bg-red-50 border-red-400"
                      : zone.severity === "Moderate"
                      ? "bg-orange-50 border-orange-400"
                      : zone.severity === "Mild"
                      ? "bg-yellow-50 border-yellow-400"
                      : "bg-blue-50 border-blue-300"
                  }`}
                >
                  <h5 className="font-bold text-lg">
                    Zone {idx + 1} - {zone.severity} Delamination (
                    {zone.confidence} Confidence)
                  </h5>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      • Location: {zone.start.toFixed(1)}" to{" "}
                      {zone.end.toFixed(1)}" from beam end
                    </p>
                    <p>
                      • Span: {(zone.end - zone.start).toFixed(1)}" with{" "}
                      {zone.points.length} measurement
                      {zone.points.length > 1 ? "s" : ""}
                    </p>
                    <p>
                      • TOF Range: {zone.minTOF.toFixed(0)} -{" "}
                      {zone.maxTOF.toFixed(0)} μs (Peak:{" "}
                      {zone.maxTOF.toFixed(0)} μs)
                    </p>
                    <p>
                      • Average in zone: {zone.avgTOF.toFixed(0)} μs (Baseline:{" "}
                      {analysis.mean.toFixed(0)} μs)
                    </p>
                    <p className="text-xs text-gray-600 mt-2 italic">
                      Pattern:{" "}
                      {zone.points.map((p) => p.tof.toFixed(0)).join(" → ")} μs
                    </p>
                    <p className="text-xs text-gray-600">
                      At positions:{" "}
                      {zone.points
                        .map((p) => p.position.toFixed(0))
                        .join('", ')}
                      "
                    </p>

                    {zone.needsMoreData && (
                      <div className="mt-2 p-2 bg-white rounded border">
                        <p className="font-medium text-orange-700">
                          ⚠️ Recommendation:
                        </p>
                        <p className="text-xs">
                          Take additional measurements at{" "}
                          {zone.suggestedInterval}" intervals to better map the
                          full delamination extent.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {layerAnalysis?.hasDelamination && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-bold flex items-center gap-2 text-purple-700">
                    <CheckCircle className="w-5 h-5" />
                    Layer Analysis Complete
                  </h4>
                  <div className="mt-2 space-y-2">
                    {layerAnalysis.identifiedLayers.map((layer, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded border border-purple-200"
                      >
                        <p className="font-medium text-purple-800">
                          Delamination at:{" "}
                          <span className="font-bold">{layer.layerName}</span>
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          Depth: {layer.depth}" from surface
                        </p>
                        <p className="text-sm text-gray-600">
                          Confidence: {layer.confidence}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-bold flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                No Delamination Detected
              </h4>
              <p className="mt-2 text-sm">
                All measurements are within normal range.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Glulam Beam NDT Analyzer
          </h1>
          <p className="text-gray-600 mb-6 text-sm md:text-base">
            Non-Destructive Testing for Adhesive Delamination Detection
          </p>

          <div className="flex items-center justify-between mb-8 text-xs md:text-sm">
            <div
              className={`flex-1 text-center ${
                step >= 1 ? "text-blue-600 font-bold" : "text-gray-400"
              }`}
            >
              Setup
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div
              className={`flex-1 text-center ${
                step >= 2 ? "text-blue-600 font-bold" : "text-gray-400"
              }`}
            >
              Thickness Test
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div
              className={`flex-1 text-center ${
                step >= 3 ? "text-blue-600 font-bold" : "text-gray-400"
              }`}
            >
              Layer Test
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div
              className={`flex-1 text-center ${
                step >= 4 ? "text-blue-600 font-bold" : "text-gray-400"
              }`}
            >
              Results
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl md:text-2xl font-bold">
                Beam Configuration
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Beam Length
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setBeamLength("8ft")}
                      className={`flex-1 py-3 px-4 md:px-6 rounded-lg border-2 transition-all text-sm md:text-base ${
                        beamLength === "8ft"
                          ? "border-blue-500 bg-blue-50 text-blue-700 font-bold"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      8 ft
                    </button>
                    <button
                      onClick={() => setBeamLength("12ft")}
                      className={`flex-1 py-3 px-4 md:px-6 rounded-lg border-2 transition-all text-sm md:text-base ${
                        beamLength === "12ft"
                          ? "border-blue-500 bg-blue-50 text-blue-700 font-bold"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      12 ft
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> This tool is designed for 6-layer
                    glulam beams with 5 glue lines.
                  </p>
                </div>

                <button
                  onClick={() => beamLength && setStep(2)}
                  disabled={!beamLength}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  Continue to Thickness-wise Test
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl md:text-2xl font-bold">
                Thickness-wise TOF Measurements
              </h2>
              <p className="text-sm md:text-base text-gray-600">
                Enter measurements at any positions. Minimum 3 points needed.
              </p>

              <div className="space-y-3 max-h-96 overflow-y-auto p-2">
                {measurements.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex gap-2 items-center bg-gray-50 p-2 rounded"
                  >
                    <div className="w-8 text-sm text-gray-500 font-medium">
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.1"
                        value={m.position}
                        onChange={(e) =>
                          updateMeasurement(idx, "position", e.target.value)
                        }
                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                        placeholder="Position (in)"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.1"
                        value={m.tof}
                        onChange={(e) =>
                          updateMeasurement(idx, "tof", e.target.value)
                        }
                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                        placeholder="TOF (μs)"
                      />
                    </div>
                    {measurements.length > 1 && (
                      <button
                        onClick={() => removeMeasurement(idx)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addMeasurement}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Measurement Point
              </button>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 md:px-6 py-3 border-2 border-gray-300 rounded-lg font-bold hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={analyzeThicknessData}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                >
                  Analyze (
                  {measurements.filter((m) => m.position && m.tof).length}{" "}
                  points)
                </button>
              </div>
            </div>
          )}

          {step === 3 && analysis?.hasDelamination && (
            <div className="space-y-6">
              <h2 className="text-xl md:text-2xl font-bold">Layer Test</h2>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="font-medium text-yellow-800">
                  {analysis.zones.length} zone(s) detected
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded">
                <p className="text-sm font-medium mb-2">Select a zone:</p>
                <div className="space-y-2">
                  {analysis.zones.map((zone, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedZone(zone)}
                      className={`w-full p-3 rounded border-2 text-left text-sm ${
                        selectedZone === zone
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300"
                      }`}
                    >
                      Zone {idx + 1}: {zone.start.toFixed(1)} -{" "}
                      {zone.end.toFixed(1)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedZone && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {layerPositions.map((layer) => (
                      <div key={layer}>
                        <label className="block text-sm font-medium mb-1">
                          {layer}"
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={layerData[layer] || ""}
                          onChange={(e) =>
                            handleLayerInput(layer, e.target.value)
                          }
                          className="w-full px-3 py-2 border rounded text-sm"
                          placeholder="μs"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={analyzeLayerData}
                    className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
                  >
                    Identify Layer
                  </button>
                </>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg font-bold"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-bold"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {step === 4 && analysis && renderBeamSchematic()}

          {step === 4 && (
            <div className="mt-6">
              <button
                onClick={() => {
                  setStep(1);
                  setBeamLength("");
                  setMeasurements([{ position: "", tof: "" }]);
                  setAnalysis(null);
                  setSelectedZone(null);
                  setLayerData({});
                  setLayerAnalysis(null);
                }}
                className="w-full py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700"
              >
                Start New Test
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlulamNDTApp;
