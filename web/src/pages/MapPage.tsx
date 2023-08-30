import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import {useApi} from "../hooks/useApi.ts";
import {Button, Col, Modal, notification, Row, Slider, Typography} from "antd";
import {useWS} from "../hooks/useWS.ts";
import {ChangeEvent, useCallback, useEffect, useState} from "react";
import {Gps, Map as MapType, MapArea, MarkerArray, Twist} from "../types/ros.ts";
import DrawControl from "../components/DrawControl.tsx";
import Map, {Layer, Source} from 'react-map-gl';
import type {Feature} from 'geojson';
import {LineString, Polygon, Position} from "geojson";
import {MowerActions, useMowerAction} from "../components/MowerActions.tsx";
import {MowerMapMapArea} from "../api/Api.ts";
import AsyncButton from "../components/AsyncButton.tsx";
import {MapStyle} from "./MapStyle.tsx";
import {converter, drawLine, getQuaternionFromHeading, itranspose, meterInDegree, transpose} from "../utils/map.tsx";
import {Joystick} from "react-joystick-component";
import {IJoystickUpdateEvent} from "react-joystick-component/src/Joystick.tsx";
import {useHighLevelStatus} from "../hooks/useHighLevelStatus.tsx";

export const MapPage = () => {
    const [notificationInstance, notificationContextHolder] = notification.useNotification();
    const mowerAction = useMowerAction()
    const highLevelStatus = useHighLevelStatus(notificationInstance)
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const [modalOpen, setModalOpen] = useState<boolean>(false)
    const [currentFeature, setCurrentFeature] = useState<Feature | undefined>(undefined)
    const [offsetYTimeout, setOffsetYTimeout] = useState<number | null>(null)
    const [offsetXTimeout, setOffsetXTimeout] = useState<number | null>(null)


    const guiApi = useApi()
    const [tileUri, setTileUri] = useState<string | undefined>()
    const [editMap, setEditMap] = useState<boolean>(false)
    const [recordTimer, setRecordTimer] = useState<number | undefined>()
    const [features, setFeatures] = useState<Record<string, Feature>>({});
    const [mapKey, setMapKey] = useState<string>("origin")
    const [map, setMap] = useState<MapType | undefined>(undefined)
    const [path, setPath] = useState<MarkerArray | undefined>(undefined)
    const [settings, setSettings] = useState<Record<string, any>>({})
    useEffect(() => {
        (async () => {
            try {
                const config = await guiApi.config.envsList()
                if (config.error) {
                    throw new Error(config.error.error ?? "")
                }
                setTileUri(config.data.tileUri)
                const offsetConfig = await guiApi.config.keysGetCreate({
                    "gui.map.offset.x": "0",
                    "gui.map.offset.y": "0",
                })
                if (offsetConfig.error) {
                    throw new Error(offsetConfig.error.error ?? "")
                }
                setOffsetX(parseFloat(offsetConfig.data["gui.map.offset.x"] ?? 0))
                setOffsetY(parseFloat(offsetConfig.data["gui.map.offset.y"] ?? 0))
                const settings = await guiApi.settings.settingsList()
                if (settings.error) {
                    throw new Error(settings.error.error ?? "")
                }
                setSettings(settings.data.settings ?? {})
            } catch (e: any) {
                notificationInstance.error({
                    message: "Failed to load settings",
                    description: e.message,
                })
            }
        })()
    }, [])
    useEffect(() => {
        if (editMap) {
            mapStream.stop()
            gpsStream.stop()
            pathStream.stop()
            setPath(undefined)
        } else {
            if (settings["OM_DATUM_LONG"] == undefined || settings["OM_DATUM_LAT"] == undefined) {
                return
            }
            gpsStream.start("/api/openmower/subscribe/gps",)
            mapStream.start("/api/openmower/subscribe/map",)
            pathStream.start("/api/openmower/subscribe/path")
        }
    }, [editMap])
    const gpsStream = useWS<string>(() => {
            notificationInstance.info({
                message: "GPS Stream closed",
            })
        }, () => {
            notificationInstance.info({
                message: "GPS Stream connected",
            })
        },
        (e) => {
            const gps = JSON.parse(e) as Gps
            const mower_lonlat = transpose(offsetX, offsetY, datum, gps.Pose?.Pose?.Position?.Y!!, gps.Pose?.Pose?.Position?.X!!)
            setFeatures(oldFeatures => {
                let orientation = gps.MotionHeading!!;
                const line = drawLine(mower_lonlat[0], mower_lonlat[1], orientation, meterInDegree / 2)
                return {
                    ...oldFeatures, mower: {
                        id: "mower",
                        type: "Feature",
                        properties: {
                            "color": "#00a6ff",
                        },
                        geometry: {
                            coordinates: mower_lonlat,
                            type: "Point",
                        }
                    }, ['mower-heading']: {
                        id: "mower-heading",
                        type: "Feature",
                        properties: {
                            "color": "#ff0000",
                        },
                        geometry: {
                            coordinates: [mower_lonlat, line],
                            type: "LineString",
                        }
                    }
                }
            })
        });

    function buildFeatures(areas: MapArea[] | undefined, type: string) {
        return areas?.flatMap((area, index) => {
            const map = {
                id: type + "-" + index + "-area-0",
                type: 'Feature',
                properties: {
                    "color": type == "navigation" ? "white" : "#01d30d",
                },
                geometry: {
                    coordinates: [area.Area?.Points?.map((point) => {
                        return transpose(offsetX, offsetY, datum, point.Y!!, point.X!!)
                    })],
                    type: "Polygon"
                }
            } as Feature;
            const obstacles = area.Obstacles?.map((obstacle, oindex) => {
                return {
                    id: type + "-" + index + "-obstacle-" + oindex,
                    type: 'Feature',
                    properties: {
                        "color": "#bf0000",
                    },
                    geometry: {
                        coordinates: [obstacle.Points?.map((point) => {
                            return transpose(offsetX, offsetY, datum, point.Y!!, point.X!!)
                        })],
                        type: "Polygon"
                    }
                } as Feature;
            })
            return [map, ...obstacles ?? []]
        }).reduce((acc, val) => {
            if (val.id == undefined) {
                return acc
            }
            acc[val.id] = val;
            return acc;
        }, {} as Record<string, Feature>);
    }

    const mapStream = useWS<string>(() => {
            notificationInstance.info({
                message: "MAP Stream closed",
            })
        }, () => {
            notificationInstance.info({
                message: "MAP Stream connected",
            })
        },
        (e) => {
            let parse = JSON.parse(e) as MapType;
            setMap(parse)
            setMapKey("live")
        });

    const pathStream = useWS<string>(() => {
            notificationInstance.info({
                message: "PATH Stream closed",
            })
        }, () => {
            notificationInstance.info({
                message: "PATH Stream connected",
            })
        },
        (e) => {
            let parse = JSON.parse(e) as MarkerArray;
            setPath(parse)
        });

    const joyStream = useWS<string>(() => {
            notificationInstance.info({
                message: "Joystick Stream closed",
            })
        }, () => {
            notificationInstance.info({
                message: "Joystick Stream connected",
            })
        },
        () => {
        });

    useEffect(() => {
        if (settings["OM_DATUM_LONG"] == undefined || settings["OM_DATUM_LAT"] == undefined) {
            return
        }
        gpsStream.start("/api/openmower/subscribe/gps",)
        mapStream.start("/api/openmower/subscribe/map",)
        pathStream.start("/api/openmower/subscribe/path")
    }, [settings]);

    useEffect(() => {
        return () => {
            gpsStream.stop()
            mapStream.stop()
            pathStream.stop()
            joyStream.stop()
        }
    }, [])

    useEffect(() => {
        let newFeatures: Record<string, Feature> = {}
        if (map) {
            const workingAreas = buildFeatures(map.WorkingArea, "area")
            const navigationAreas = buildFeatures(map.NavigationAreas, "navigation")
            newFeatures = {...workingAreas, ...navigationAreas}
            const dock_lonlat = transpose(offsetX, offsetY, datum, map?.DockY!!, map?.DockX!!)
            newFeatures["dock"] = {
                id: "dock",
                type: "Feature",
                properties: {
                    "color": "#ff00f2",
                },
                geometry: {
                    coordinates: dock_lonlat,
                    type: "Point",
                }
            }
        }
        if (path) {
            path.Markers.forEach((marker, index) => {
                const line: Position[] = marker.Points.map(point => {
                    return transpose(offsetX, offsetY, datum, point.Y!!, point.X!!)
                })
                const feature: Feature<LineString> = {
                    id: "path-" + index,
                    type: 'Feature',
                    properties: {
                        color: `rgb(${marker.Color.R}, ${marker.Color.G}, ${marker.Color.B}, ${marker.Color.A})`
                    },
                    geometry: {
                        coordinates: line,
                        type: 'LineString'
                    }
                }
                newFeatures[feature.id as string] = feature
                return feature
            })
        }
        setFeatures(newFeatures)
    }, [map, path, offsetX, offsetY]);

    function getNewId(currFeatures: Record<string, Feature>, type: string, component: string) {
        const maxArea = Object.values<Feature>(currFeatures).filter((f) => {
            let idDetails = (f.id as string).split("-")
            if (idDetails.length != 4) {
                return false
            }
            let areaType = idDetails[0]
            let areaComponent = idDetails[2]
            return areaType == type && component == areaComponent
        }).reduce((acc, val) => {
            let idDetails = (val.id as string).split("-")
            if (idDetails.length != 4) {
                return acc
            }
            let index = parseInt(idDetails[1])
            if (index > acc) {
                return index
            }
            return acc
        }, 0)
        const maxComponent = Object.values<Feature>(currFeatures).filter((f) => {
            return (f.id as string).startsWith(type + "-" + (maxArea + 1) + "-" + component + "-")
        }).reduce((acc, val) => {
            let idDetails = (val.id as string).split("-")
            if (idDetails.length != 4) {
                return acc
            }
            let index = parseInt(idDetails[3])
            if (index > acc) {
                return index
            }
            return acc
        }, 0)
        return type + "-" + (maxArea + 1) + "-" + component + "-" + maxComponent + 1;
    }

    function saveNavigationArea() {
        if (currentFeature == undefined) {
            return
        }
        setFeatures(currFeatures => {
            let id = getNewId(currFeatures, "navigation", "area");
            currentFeature.id = id
            currentFeature.properties = {
                color: "white",
            }
            return {...currFeatures, [id]: currentFeature};
        })
        setCurrentFeature(undefined)
        setModalOpen(false)
    }

    function saveMowingArea() {
        if (currentFeature == undefined) {
            return
        }
        setFeatures(currFeatures => {
            let id = getNewId(currFeatures, "area", "area");
            currentFeature.id = id
            currentFeature.properties = {
                color: "#01d30d",
            }
            return {...currFeatures, [id]: currentFeature};
        })
        setCurrentFeature(undefined)
        setModalOpen(false)
    }

    const inside = (currentLayerCoordinates: Position[], areaCoordinates: Position[]) => {
        let inside = false;
        let j = areaCoordinates.length - 1;
        for (let i = 0; i < areaCoordinates.length; i++) {
            const xi = areaCoordinates[i][0];
            const yi = areaCoordinates[i][1];
            const xj = areaCoordinates[j][0];
            const yj = areaCoordinates[j][1];

            const intersect = ((yi > currentLayerCoordinates[1][1]) !== (yj > currentLayerCoordinates[1][1]))
                && (currentLayerCoordinates[1][0] < (xj - xi) * (currentLayerCoordinates[1][1] - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
            j = i;
        }
        return inside;
    };

    function deleteFeature() {
        if (currentFeature == undefined) {
            return
        }
        setFeatures(currFeatures => {
            const newFeatures = {...currFeatures};
            delete newFeatures[currentFeature.id!!]
            return newFeatures
        })
        setCurrentFeature(undefined)
        setModalOpen(false)
    }

    function saveObstacle() {
        if (currentFeature == undefined) {
            return
        }
        setFeatures(currFeatures => {
            const currentLayerCoordinates = (currentFeature as Feature<Polygon>).geometry.coordinates[0]
            // find the area that contains the obstacle
            const area = Object.values<Feature>(currFeatures).find((f) => {
                if (f.geometry.type != "Polygon") {
                    return false
                }
                const areaCoordinates = (f as Feature<Polygon>).geometry.coordinates[0]
                return inside(currentLayerCoordinates, areaCoordinates)
            })
            if (!area) {
                return currFeatures
            }
            const areaType = (area.id as string).split("-")[0]
            let id = getNewId(currFeatures, areaType, "obstacle");
            currentFeature.id = id
            currentFeature.properties = {
                color: "#bf0000",
            }
            return {...currFeatures, [id]: currentFeature} as Record<string, Feature>;
        })
        setCurrentFeature(undefined)
        setModalOpen(false)
    }

    const onCreate = useCallback((e: any) => {
        for (const f of e.features) {
            setCurrentFeature(f)
            setModalOpen(true)
        }
    }, []);

    const onUpdate = useCallback((e: any) => {
        setFeatures(currFeatures => {
            const newFeatures = {...currFeatures};
            for (const f of e.features) {
                newFeatures[f.id] = f;
            }
            return newFeatures;
        });
    }, []);

    const onDelete = useCallback((e: any) => {
        setFeatures(currFeatures => {
            const newFeatures = {...currFeatures};
            for (const f of e.features) {
                delete newFeatures[f.id];
            }
            return newFeatures;
        });
    }, []);

    const _datumLon = parseFloat(settings["OM_DATUM_LONG"] ?? 0)
    const _datumLat = parseFloat(settings["OM_DATUM_LAT"] ?? 0)
    if (_datumLon == 0 || _datumLat == 0) {
        return <>Loading</>
    }
    const datum: [number, number, number] = [0, 0, 0]
    converter.LLtoUTM(_datumLat, _datumLon, datum)
    const map_center = (map && map.MapCenterY && map.MapCenterX) ? transpose(offsetX, offsetY, datum, map.MapCenterY, map.MapCenterX) : [_datumLon, _datumLat]
    const center: [number, number, number] = [0, 0, 0]
    converter.LLtoUTM(map_center[1], map_center[0], center)
    const map_ne = transpose(offsetX, offsetY, center, ((map?.MapHeight ?? 10) / 2), ((map?.MapWidth ?? 10) / 2))
    const map_sw = transpose(offsetX, offsetY, center, -((map?.MapHeight ?? 10) / 2), -((map?.MapWidth ?? 10) / 2))

    function handleEditMap() {
        setEditMap(!editMap)
    }

    async function handleSaveMap() {
        const areas: Record<string, Record<string, MowerMapMapArea>> = {}
        for (const f of Object.values<Feature>(features)) {
            let id = f.id as string;
            let idDetails = id.split("-")
            if (idDetails.length != 4) {
                continue
            }
            let type = idDetails[0]
            let index = idDetails[1]
            let component = idDetails[2]
            areas[type] = areas[type] ?? {}
            areas[type][index] = areas[type][index] ?? {}

            const feature = f as Feature<Polygon>
            const points = feature.geometry.coordinates[0].map((point) => {
                return itranspose(offsetX, offsetY, datum, point[1], point[0])
            })
            if (component == "area") {
                areas[type][index].area = {
                    points: points.map((point) => {
                        return {
                            x: point[0],
                            y: point[1],
                            z: 0,
                        }
                    })
                }
            } else if (component == "obstacle") {
                areas[type][index].obstacles = [...(areas[type][index].obstacles ?? []), {
                    points: points.map((point) => {
                        return {
                            x: point[0],
                            y: point[1],
                            z: 0,
                        }
                    })
                }]
            }
        }
        try {
            await guiApi.openmower.deleteOpenmower()
            notificationInstance.success({
                message: "Map deleted",
            })
            setEditMap(false)
        } catch (e: any) {
            notificationInstance.error({
                message: "Failed to delete map",
                description: e.message,
            })
        }
        for (const [type, areasOfType] of Object.entries(areas)) {
            for (const [_, area] of Object.entries(areasOfType)) {
                try {
                    await guiApi.openmower.mapAreaAddCreate({
                        area: area,
                        isNavigationArea: type == "navigation",
                    })
                    notificationInstance.success({
                        message: "Area saved",
                    })
                    setEditMap(false)
                } catch (e: any) {
                    notificationInstance.error({
                        message: "Failed to save area",
                        description: e.message,
                    })
                }
            }
        }
        if (!map) {
            await guiApi.openmower.mapDockingCreate({
                dockingPose: {
                    orientation: {
                        x: 0,
                        y: 0,
                        z: 0,
                        w: 1,
                    },
                    position: {
                        x: 0,
                        y: 0,
                        z: 0,
                    }
                }
            })
        } else {
            let quaternionFromHeading = getQuaternionFromHeading(map?.DockHeading!!);
            await guiApi.openmower.mapDockingCreate({
                dockingPose: {
                    orientation: {
                        x: quaternionFromHeading.X!!,
                        y: quaternionFromHeading.Y!!,
                        z: quaternionFromHeading.Z!!,
                        w: quaternionFromHeading.W!!,
                    },
                    position: {
                        x: map?.DockX!!,
                        y: map?.DockY!!,
                        z: 0,
                    }
                }
            })
        }

    }

    const handleBackupMap = () => {
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style.display = "none";
        const json = JSON.stringify(map),
            blob = new Blob([json], {type: "octet/stream"}),
            url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = "map.json";
        a.click();
        window.URL.revokeObjectURL(url);
    };
    const handleRestoreMap = () => {
        /*<input id="file-input" type="file" name="name" style="display: none;" />*/
        const input = document.createElement("input");
        input.type = "file";
        input.style.display = "none";
        document.body.appendChild(input);
        input.addEventListener('change', (event) => {
            setEditMap(true)
            const file = (event as unknown as ChangeEvent<HTMLInputElement>).target?.files?.[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.addEventListener('load', (event) => {
                let content = event.target?.result as string;
                let parts = content.split(",");
                let newMap = JSON.parse(atob(parts[1])) as MapType;
                setMap(newMap)
            });
            reader.readAsDataURL(file);
        })
        input.click();
    };
    const handleRecordingMode = async () => {
        setEditMap(false)
        await mowerAction(
            "high_level_control",
            {
                Command: 3,
            }
        )()
        joyStream.start("/api/openmower/publish/joy")
    };

    const handleStopRecordingMode = async () => {
        setEditMap(false)
        clearInterval(recordTimer)
        await mowerAction(
            "high_level_control",
            {
                Command: 2,
            }
        )()
        joyStream.stop()
    };

    const handleJoyMove = (event: IJoystickUpdateEvent) => {
        let newVar: Twist = {
            Linear: {
                X: event.x ?? 0,
                Y: event.y ?? 0,
            },
        };
        clearInterval(recordTimer)
        setRecordTimer(setInterval(() => {
            joyStream.sendJsonMessage(newVar)
        }, 10))
    };
    const handleJoyStop = () => {
        let newVar: Twist = {
            Linear: {
                X: 0,
                Y: 0,
            },
        };
        clearInterval(recordTimer)
        setRecordTimer(setInterval(() => {
            joyStream.sendJsonMessage(newVar)
        }, 10))
    };

    const handleOffsetX = (value: number) => {
        if (offsetXTimeout != null) {
            clearTimeout(offsetXTimeout)
        }
        setOffsetXTimeout(setTimeout(() => {
            (async () => {
                try {
                    const offsetConfig = await guiApi.config.keysSetCreate({
                        "gui.map.offset.x": value.toString(),
                    })
                    if (offsetConfig.error) {
                        throw new Error(offsetConfig.error.error ?? "")
                    }
                } catch (e: any) {
                    notificationInstance.error({
                        message: "Failed to save offset",
                        description: e.message,
                    })
                }
            })()
        }, 1000))
        setOffsetX(value)
    }
    const handleOffsetY = (value: number) => {
        if (offsetYTimeout != null) {
            clearTimeout(offsetYTimeout)
        }
        setOffsetYTimeout(setTimeout(() => {
            (async () => {
                try {
                    const offsetConfig = await guiApi.config.keysSetCreate({
                        "gui.map.offset.y": value.toString(),
                    })
                    if (offsetConfig.error) {
                        throw new Error(offsetConfig.error.error ?? "")
                    }
                } catch (e: any) {
                    notificationInstance.error({
                        message: "Failed to save offset",
                        description: e.message,
                    })
                }
            })()
        }, 1000))
        setOffsetY(value)
    }
    return (
        <Row gutter={[16, 16]} align={"top"} style={{height: '100%'}}>
            <Modal
                open={modalOpen}
                title={"Set the area type"}
                footer={[
                    <Button style={{paddingRight: 10}} key="mowing" type="primary" onClick={saveMowingArea}>
                        Working area
                    </Button>,
                    <Button style={{paddingRight: 10}} key="navigation" onClick={saveNavigationArea}>
                        Navigation area
                    </Button>,
                    <Button style={{paddingRight: 10}} key="obstacle" onClick={saveObstacle}>
                        Obstacle
                    </Button>,
                    <Button key="cancel" onClick={deleteFeature}>
                        Cancel
                    </Button>,
                ]}
                onOk={saveMowingArea}
                onCancel={deleteFeature}
            />
            {notificationContextHolder}
            <Col span={24}>
                <Typography.Title level={2}>Map</Typography.Title>
                <Typography.Title level={5} style={{color: "#ff0000"}}>WARNING: Beta, please backup your map before
                    use</Typography.Title>
            </Col>
            <Col span={24}>
                <MowerActions api={notificationInstance} highLevelStatus={highLevelStatus} showStatus>
                    {!editMap && <Button size={"small"} type="primary" onClick={handleEditMap}
                                         style={{marginRight: 10}}>Edit Map</Button>}
                    {editMap && <AsyncButton size={"small"} type="primary" onAsyncClick={handleSaveMap}
                                             style={{marginRight: 10}}>Save Map</AsyncButton>}
                    {editMap && <Button size={"small"} onClick={handleEditMap}
                                        style={{marginRight: 10}}>Cancel Map Edition</Button>}
                    {highLevelStatus.StateName !== "AREA_RECORDING" &&
                        <AsyncButton size={"small"} onAsyncClick={handleRecordingMode}
                                                 style={{marginRight: 10}}>Recording Mode</AsyncButton>}
                    {highLevelStatus.StateName === "AREA_RECORDING" &&
                        <AsyncButton size={"small"} onAsyncClick={handleStopRecordingMode}
                                     style={{marginRight: 10}}>Stop Recording Mode</AsyncButton>}
                    <Button size={"small"} onClick={handleBackupMap}
                            style={{marginRight: 10}}>Backup Map</Button>
                    <Button size={"small"} onClick={handleRestoreMap}
                            style={{marginRight: 10}}>Restore Map</Button>
                </MowerActions>
            </Col>
            <Col span={24}>
                <Row>
                    <Col span={12}>
                        <Slider value={offsetX} onChange={handleOffsetX} min={-30} max={30} step={0.01}/>
                    </Col>
                    <Col span={12}>
                        <Slider value={offsetY} onChange={handleOffsetY} min={-30} max={30} step={0.01}/>
                    </Col>
                </Row>
            </Col>
            <Col span={24} style={{height: '70%'}}>
                <Map key={mapKey}
                     antialias
                     projection={{
                         name: "globe"
                     }}
                     mapboxAccessToken="pk.eyJ1IjoiZmFrZXVzZXJnaXRodWIiLCJhIjoiY2pwOGlneGI4MDNnaDN1c2J0eW5zb2ZiNyJ9.mALv0tCpbYUPtzT7YysA2g"
                     initialViewState={{
                         bounds: [{lng: map_sw[0], lat: map_sw[1]}, {lng: map_ne[0], lat: map_ne[1]}],
                     }}
                     style={{width: '100%', height: '100%'}}
                     mapStyle={"mapbox://styles/mapbox/satellite-streets-v12"}
                >
                    {tileUri ? <Source type={"raster"} id={"custom-raster"} tiles={[tileUri]} tileSize={256}/> : null}
                    {tileUri ? <Layer type={"raster"} source={"custom-raster"} id={"custom-layer"}/> : null}
                    <DrawControl
                        styles={MapStyle}
                        userProperties={true}
                        features={Object.values(features)}
                        position="top-left"
                        displayControlsDefault={false}
                        editMode={editMap}
                        controls={{
                            polygon: true,
                            trash: true
                        }}
                        defaultMode="simple_select"
                        onCreate={onCreate}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                    />
                </Map>
                {highLevelStatus.StateName === "AREA_RECORDING" &&
                    <div style={{position: "absolute", bottom: 30, right: 30, zIndex: 100}}>
                    <Joystick move={handleJoyMove} stop={handleJoyStop}/>
                </div>}
            </Col>
        </Row>
    );
}

export default MapPage;