using UnityEngine;
using System;

[Serializable]
public class NetworkMessage
{
    public string type;
    public string clientId;
    public string objectId;
    public float x, y, z;
    public float r, g, b;
    public string content;
    public long timestamp;
}
